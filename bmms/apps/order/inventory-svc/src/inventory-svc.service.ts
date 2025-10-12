import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';

import { Inventory } from './entities/inventory.entity';
import { InventoryReservation } from './entities/inventory-reservation.entity';
import { InventoryHistory } from './entities/inventory-history.entity';

import { CreateInventoryDto } from './dto/create-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { ReleaseInventoryDto } from './dto/release-inventory.dto';
import { BulkReserveDto } from './dto/bulk-reserve.dto';
import { EventTopics } from '@bmms/event';


@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,

    @InjectRepository(InventoryReservation)
    private readonly reservationRepo: Repository<InventoryReservation>,

    @InjectRepository(InventoryHistory)
    private readonly historyRepo: Repository<InventoryHistory>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  // ============= CRUD =============

  async create(dto: CreateInventoryDto): Promise<Inventory> {
    const existing = await this.inventoryRepo.findOne({
      where: { productId: dto.productId },
    });

    if (existing) {
      throw new ConflictException(
        `Inventory for product ${dto.productId} already exists`,
      );
    }

    const inventory = await this.inventoryRepo.save(
      this.inventoryRepo.create(dto),
    );

    this.kafka.emit(EventTopics.INVENTORY_CREATED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVENTORY_CREATED,
      timestamp: new Date(),
      source: 'inventory-svc',
      data: {
        id: inventory.id,
        productId: inventory.productId,
        quantity: inventory.quantity,
        createdAt: inventory.createdAt,
      },
    });

    return inventory;
  }

  async getByProduct(productId: number): Promise<Inventory> {
    const inventory = await this.inventoryRepo.findOne({
      where: { productId },
      relations: ['reservations'],
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory for product ${productId} not found`);
    }

    return inventory;
  }

  async listAll(): Promise<Inventory[]> {
    return this.inventoryRepo.find({ relations: ['reservations'] });
  }

  async getLowStockItems(): Promise<Inventory[]> {
    return this.inventoryRepo
      .createQueryBuilder('inventory')
      .where('inventory.quantity <= inventory.reorderLevel')
      .getMany();
  }

  // ============= ADJUST STOCK =============

  async adjust(
    productId: number,
    dto: AdjustInventoryDto,
  ): Promise<Inventory> {
    const inventory = await this.getByProduct(productId);
    const previousQuantity = inventory.quantity;

    inventory.quantity += dto.adjustment;

    if (inventory.quantity < 0) {
      throw new BadRequestException(
        `Adjustment would result in negative stock. Current: ${previousQuantity}, Adjustment: ${dto.adjustment}`,
      );
    }

    const updated = await this.inventoryRepo.save(inventory);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        productId,
        previousQuantity,
        currentQuantity: updated.quantity,
        change: dto.adjustment,
        reason: dto.reason,
        notes: dto.notes,
      }),
    );

    this.kafka.emit(EventTopics.INVENTORY_ADJUSTED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVENTORY_ADJUSTED,
      timestamp: new Date(),
      source: 'inventory-svc',
      data: {
        productId,
        previousQuantity,
        currentQuantity: updated.quantity,
        adjustment: dto.adjustment,
        reason: dto.reason,
      },
    });

    return updated;
  }

  // ============= RESERVE STOCK =============

  async reserve(dto: ReserveInventoryDto): Promise<InventoryReservation> {
    const inventory = await this.getByProduct(dto.productId);

    if (inventory.getAvailableQuantity() < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${inventory.getAvailableQuantity()}, Requested: ${dto.quantity}`,
      );
    }

    const reservation = await this.reservationRepo.save(
      this.reservationRepo.create({
        ...dto,
        status: 'active',
        expiresAt: dto.reservationExpiry || new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24h
      }),
    );

    inventory.reserved += dto.quantity;
    await this.inventoryRepo.save(inventory);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        productId: dto.productId,
        previousQuantity: inventory.quantity - dto.quantity,
        currentQuantity: inventory.quantity,
        change: -dto.quantity,
        reason: 'reservation',
        orderId: dto.orderId,
        notes: `Reserved for order ${dto.orderId}`,
      }),
    );

    this.kafka.emit(EventTopics.INVENTORY_RESERVED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVENTORY_RESERVED,
      timestamp: new Date(),
      source: 'inventory-svc',
      data: {
        reservationId: reservation.id,
        productId: dto.productId,
        quantity: dto.quantity,
        orderId: dto.orderId,
        customerId: dto.customerId,
      },
    });

    return reservation;
  }

  async bulkReserve(dto: BulkReserveDto): Promise<InventoryReservation[]> {
    const reservations: InventoryReservation[] = [];

    for (const item of dto.items) {
      const reservation = await this.reserve({
        productId: item.productId,
        quantity: item.quantity,
        orderId: dto.orderId,
        customerId: dto.customerId,
      });
      reservations.push(reservation);
    }

    return reservations;
  }

  // ============= RELEASE STOCK =============

  async release(dto: ReleaseInventoryDto): Promise<Inventory> {
    const inventory = await this.getByProduct(dto.productId);

    const reservation = await this.reservationRepo.findOne({
      where: {
        productId: dto.productId,
        orderId: dto.orderId,
        status: 'active',
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `No active reservation found for product ${dto.productId} and order ${dto.orderId}`,
      );
    }

    const previousQuantity = inventory.quantity;

    if (dto.reason === 'order_completed') {
      // Stock deducted, release reservation
      inventory.reserved -= reservation.quantity;
    } else if (
      dto.reason === 'order_cancelled' ||
      dto.reason === 'manual_release'
    ) {
      // Return stock
      inventory.quantity += reservation.quantity;
      inventory.reserved -= reservation.quantity;
    }

    reservation.status = 'cancelled';
    await this.reservationRepo.save(reservation);
    const updated = await this.inventoryRepo.save(inventory);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        productId: dto.productId,
        previousQuantity,
        currentQuantity: updated.quantity,
        change: inventory.quantity - previousQuantity,
        reason: 'release',
        orderId: dto.orderId,
        notes: `Released - ${dto.reason}`,
      }),
    );

    this.kafka.emit(EventTopics.INVENTORY_RELEASED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVENTORY_RELEASED,
      timestamp: new Date(),
      source: 'inventory-svc',
      data: {
        productId: dto.productId,
        quantity: reservation.quantity,
        orderId: dto.orderId,
        reason: dto.reason,
      },
    });

    return updated;
  }

  // ============= UTILITIES =============

  async checkStock(productId: number, requiredQuantity: number): Promise<boolean> {
    const inventory = await this.getByProduct(productId);
    return inventory.getAvailableQuantity() >= requiredQuantity;
  }

  async getInventoryHistory(productId: number, limit = 50): Promise<InventoryHistory[]> {
    return this.historyRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async cleanExpiredReservations(): Promise<void> {
    const expired = await this.reservationRepo.find({
      where: {
        status: 'active',
        expiresAt: LessThanOrEqual(new Date()),
      },
    });

    for (const reservation of expired) {
      await this.release({
        productId: reservation.productId,
        quantity: reservation.quantity,
        orderId: reservation.orderId,
        reason: 'order_cancelled',
      });
    }

    console.log(`🧹 Cleaned up ${expired.length} expired reservations`);
  }
}