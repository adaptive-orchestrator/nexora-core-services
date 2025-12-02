import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';

import { Inventory } from './entities/inventory.entity';
import { InventoryReservation } from './entities/inventory-reservation.entity';
import { InventoryHistory } from './entities/inventory-history.entity';

import { CreateInventoryDto } from './dto/create-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { ReleaseInventoryDto } from './dto/release-inventory.dto';
import { BulkReserveDto } from './dto/bulk-reserve.dto';
import { debug } from '@bmms/common';

// ✅ Import types và functions từ @bmms/event
import {
  EventTopics,
  createBaseEvent,
  InventoryCreatedEvent,
  InventoryAdjustedEvent,
  InventoryReservedEvent,
  InventoryReleasedEvent,
} from '@bmms/event';

interface CatalogueGrpcService {
  getProductById(data: { id: number }): any;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private catalogueGrpcService: CatalogueGrpcService;

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,

    @InjectRepository(InventoryReservation)
    private readonly reservationRepo: Repository<InventoryReservation>,

    @InjectRepository(InventoryHistory)
    private readonly historyRepo: Repository<InventoryHistory>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,

    @Inject('CATALOGUE_PACKAGE')
    private readonly catalogueClient: ClientGrpc,
  ) { }

  onModuleInit() {
    this.catalogueGrpcService = this.catalogueClient.getService<CatalogueGrpcService>('CatalogueService');
  }

  /**
   * Validate product exists in catalogue
   */
  private async validateProduct(productId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.catalogueGrpcService.getProductById({ id: productId }).pipe(
          catchError((error) => {
            throw new NotFoundException(`Product ${productId} not found in catalogue`);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      debug.log(`⚠️ Unable to validate product ${productId} with catalogue service`);
      // Continue anyway if catalogue service is down
    }
  }

  // ============= CRUD =============

  /**
 * Create initial inventory for a new product
 */
  async createInventoryForProduct(
    productId: number,
    initialQuantity: number = 0,
    reorderLevel: number = 10,
  ): Promise<Inventory> {
    // ✅ Check if inventory already exists
    const existingInventory = await this.inventoryRepo.findOne({
      where: { productId }
    });

    if (existingInventory) {
      debug.log(`⚠️ Inventory already exists for productId: ${productId}, skipping creation`);
      return existingInventory;
    }

    // ✅ Validate product exists in catalogue
    await this.validateProduct(productId);

    const inventory = this.inventoryRepo.create({
      productId,
      quantity: initialQuantity,  // ✅ Total quantity
      reserved: 0,                // ✅ Nothing reserved yet
      reorderLevel,
      isActive: true,
    });

    try {
      return await this.inventoryRepo.save(inventory);
    } catch (error) {
      // Handle duplicate error gracefully (race condition edge case)
      if (error.code === 'ER_DUP_ENTRY') {
        debug.warn(`⚠️ Duplicate inventory detected for productId: ${productId} (race condition), fetching existing`);
        const existing = await this.inventoryRepo.findOne({ where: { productId } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
 * Reserve stock for an order
 */
  async reserveStock(
    productId: number,
    quantity: number,
    orderId: number,
    customerId: number,
  ): Promise<InventoryReservation> {
    // ✅ Validate product exists in catalogue
    await this.validateProduct(productId);

    // Find inventory
    let inventory = await this.inventoryRepo.findOne({ where: { productId } });
    if (!inventory) {
    debug.log(`⚠️ Inventory not found for product ${productId}, creating with 0 stock...`);
    
    // ✅ Auto-create inventory record with 0 stock
    inventory = await this.createInventoryForProduct(productId, 0, 10);
    
    // ❌ Throw error vì không có stock để reserve
    throw new BadRequestException(
      `Product ${productId} has no stock available. Please restock before creating orders.`
    );
  }

    // ✅ Check available using helper method
    const available = inventory.getAvailableQuantity();
    if (available < quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    // Create reservation
    const reservation = this.reservationRepo.create({
      productId,
      quantity,
      orderId,
      customerId,
      status: 'active', // ✅ Đổi từ 'reserved' thành 'active' theo entity
    });

    const savedReservation = await this.reservationRepo.save(reservation);

    // ✅ Update inventory (only increase reserved, quantity stays the same)
    inventory.reserved += quantity;
    await this.inventoryRepo.save(inventory);

    // ✅ Emit INVENTORY_RESERVED event
    const event: InventoryReservedEvent = {
      ...createBaseEvent('inventory.reserved', 'inventory-service'),
      eventType: 'inventory.reserved',
      data: {
        reservationId: savedReservation.id,
        productId,
        quantity,
        orderId,
        customerId,
      },
    };

    debug.log('🚀 Emitting inventory.reserved event:', event);
    this.kafka.emit(EventTopics.INVENTORY_RESERVED, event);

    return savedReservation;
  }

  /**
 * Complete reservations when order is completed
 */
  async completeReservations(orderId: number): Promise<void> {
    const reservations = await this.reservationRepo.find({
      where: { orderId, status: 'active' }, // ✅ Đổi từ 'reserved' thành 'active'
    });

    for (const reservation of reservations) {
      // Update reservation status
      reservation.status = 'completed';
      await this.reservationRepo.save(reservation);

      // Update inventory (decrease both reserved and quantity)
      const inventory = await this.inventoryRepo.findOne({
        where: { productId: reservation.productId },
      });

      if (inventory) {
        inventory.reserved -= reservation.quantity;  // ✅ Release reservation
        inventory.quantity -= reservation.quantity;  // ✅ Deduct from total stock
        await this.inventoryRepo.save(inventory);
      }
    }
  }
  /**
   * Release reservations when order is cancelled
   */
  /**
 * Release reservations when order is cancelled
 */
  async releaseReservations(orderId: number, reason: string): Promise<void> {
    const reservations = await this.reservationRepo.find({
      where: { orderId, status: 'active' }, // ✅ Đổi từ 'reserved' thành 'active'
    });

    for (const reservation of reservations) {
      // Update reservation status
      reservation.status = 'cancelled'; // ✅ Đổi từ 'released' thành 'cancelled'
      await this.reservationRepo.save(reservation);

      // Update inventory (only decrease reserved, quantity stays the same)
      const inventory = await this.inventoryRepo.findOne({
        where: { productId: reservation.productId },
      });

      if (inventory) {
        // ✅ Just release reservation, quantity unchanged (stock returns to available)
        inventory.reserved -= reservation.quantity;
        await this.inventoryRepo.save(inventory);
      }

      // ✅ Emit INVENTORY_RELEASED event
      const event: InventoryReleasedEvent = {
        ...createBaseEvent('inventory.released', 'inventory-service'),
        eventType: 'inventory.released',
        data: {
          productId: reservation.productId,
          quantity: reservation.quantity,
          orderId,
          reason: reason as 'order_cancelled' | 'order_completed' | 'manual_release',
        },
      };

      debug.log('🚀 Emitting inventory.released event:', event);
      this.kafka.emit(EventTopics.INVENTORY_RELEASED, event);
    }
  }
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

    // ✅ Emit với đúng structure
    const event: InventoryCreatedEvent = {
      ...createBaseEvent(EventTopics.INVENTORY_CREATED, 'inventory-service'),
      eventType: 'inventory.created',
      data: {
        id: inventory.id,
        productId: inventory.productId,
        quantity: inventory.quantity,
        createdAt: inventory.createdAt,
      },
    };

    debug.log('🚀 Emitting inventory.created event:', event);
    this.kafka.emit(EventTopics.INVENTORY_CREATED, event);

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

  async listAll(page: number = 1, limit: number = 20): Promise<{
    items: Inventory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    
    const [items, total] = await this.inventoryRepo.findAndCount({
      relations: ['reservations'],
      skip,
      take: limit,
      order: { id: 'DESC' },
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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

    // ✅ Emit với đúng structure
    const event: InventoryAdjustedEvent = {
      ...createBaseEvent(EventTopics.INVENTORY_ADJUSTED, 'inventory-service'),
      eventType: 'inventory.adjusted',
      data: {
        productId,
        previousQuantity,
        currentQuantity: updated.quantity,
        adjustment: dto.adjustment,
        reason: dto.reason as 'restock' | 'damage' | 'loss' | 'adjustment' | 'correction',
      },
    };

    debug.log('🚀 Emitting inventory.adjusted event:', event);
    this.kafka.emit(EventTopics.INVENTORY_ADJUSTED, event);

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

    // ✅ Emit với đúng structure
    const event: InventoryReservedEvent = {
      ...createBaseEvent(EventTopics.INVENTORY_RESERVED, 'inventory-service'),
      eventType: 'inventory.reserved',
      data: {
        reservationId: reservation.id,
        productId: dto.productId,
        quantity: dto.quantity,
        orderId: dto.orderId,
        customerId: dto.customerId,
      },
    };

    debug.log('🚀 Emitting inventory.reserved event:', event);
    this.kafka.emit(EventTopics.INVENTORY_RESERVED, event);

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

    // ✅ Emit với đúng structure
    const event: InventoryReleasedEvent = {
      ...createBaseEvent(EventTopics.INVENTORY_RELEASED, 'inventory-service'),
      eventType: 'inventory.released',
      data: {
        productId: dto.productId,
        quantity: reservation.quantity,
        orderId: dto.orderId,
        reason: dto.reason as 'order_cancelled' | 'order_completed' | 'manual_release',
      },
    };

    debug.log('🚀 Emitting inventory.released event:', event);
    this.kafka.emit(EventTopics.INVENTORY_RELEASED, event);

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

    debug.log(`🧹 Cleaned up ${expired.length} expired reservations`);
  }
}
