import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderHistory } from './entities/order-history.entity';

import { CreateOrderDto } from './dto/create-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { createBaseEvent } from '@bmms/event';
import { debug } from '@bmms/common';

interface ICustomerGrpcService {
  getCustomerById(data: { id: string }): any;
}

interface ICatalogueGrpcService {
  getProductById(data: { id: string }): any;
}

interface IInventoryGrpcService {
  checkAvailability(data: { productId: string; requestedQuantity: number }): any;
  reserveStock(data: { productId: string; quantity: number; orderId: string; customerId: string }): any;
}

interface ValidatedOrderItem {
  productId: string;
  quantity: number;
  price: number;
  notes?: string;
}

@Injectable()
export class OrderSvcService implements OnModuleInit {
  private customerService: ICustomerGrpcService;
  private catalogueService: ICatalogueGrpcService;
  private inventoryService: IInventoryGrpcService;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,

    @InjectRepository(OrderHistory)
    private readonly historyRepo: Repository<OrderHistory>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,

    @Inject('CUSTOMER_PACKAGE')
    private readonly customerClient: ClientGrpc,

    @Inject('CATALOGUE_PACKAGE')
    private readonly catalogueClient: ClientGrpc,

    @Inject('INVENTORY_PACKAGE')
    private readonly inventoryClient: ClientGrpc,
  ) {}

  onModuleInit() {
    //console.log('[OrderSvc] onModuleInit called');
    //console.log('[OrderSvc] customerClient:', !!this.customerClient);
    //console.log('[OrderSvc] catalogueClient:', !!this.catalogueClient);
    //console.log('[OrderSvc] inventoryClient:', !!this.inventoryClient);
    
    this.customerService = this.customerClient.getService<ICustomerGrpcService>('CustomerService');
    this.catalogueService = this.catalogueClient.getService<ICatalogueGrpcService>('CatalogueService');
    this.inventoryService = this.inventoryClient.getService<IInventoryGrpcService>('InventoryService');
    
    //console.log('[OrderSvc] gRPC services initialized');
    //console.log('[OrderSvc] customerService:', !!this.customerService);
    //console.log('[OrderSvc] catalogueService:', !!this.catalogueService);
    //console.log('[OrderSvc] inventoryService:', !!this.inventoryService);
  }

  // ============= CRUD =============

  async create(dto: CreateOrderDto): Promise<Order> {
    console.log('[OrderSvc] create START - dto:', JSON.stringify(dto));
    console.log('[OrderSvc] create dto.customerId:', dto.customerId);
    console.log('[OrderSvc] create dto.customerId type:', typeof dto.customerId);
    
    // 1. Validate customer exists
    console.log('[OrderSvc] create Step 1: Validating customer...');
    await this.validateCustomer(dto.customerId);
    console.log('[OrderSvc] create Customer validation passed');

    // 2. Validate all products exist and get prices
    //console.log('[OrderSvc] create Step 2: Validating products...');
    const validatedItems = await this.validateProducts(dto.items);
    //console.log('[OrderSvc] create Products validated:', validatedItems);

    // 3. Validate inventory availability (throws 422 if out of stock)
    console.log('[OrderSvc] create Step 3: Validating inventory availability...');
    await this.validateInventory(validatedItems);
    console.log('[OrderSvc] create Inventory validation passed');

    // 4. Generate order number
    //console.log('[OrderSvc] create Step 4: Generating order number...');
    const orderNumber = await this.generateOrderNumber();
    //  console.log('[OrderSvc] create Order number generated:', orderNumber);

    // 5. Calculate totals
    const subtotal = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    //console.log('[OrderSvc] create Subtotal calculated:', subtotal);

    // 6. Create order
    //console.log('[OrderSvc] create Step 6: Creating order in DB...');
    const order = await this.orderRepo.save(
      this.orderRepo.create({
        orderNumber,
        customerId: dto.customerId,
        subtotal,
        totalAmount: subtotal,
        notes: dto.notes,
        shippingAddress: dto.shippingAddress,
        billingAddress: dto.billingAddress,
        status: 'pending',
      }),
    );
    //console.log('[OrderSvc] create Order created:', order.id);

    // 7. Add items
    const items = await Promise.all(
      validatedItems.map((item) =>
        this.itemRepo.save(
          this.itemRepo.create({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
            notes: item.notes,
          }),
        ),
      ),
    );

    order.items = items;
    order.totalAmount = order.calculateTotal();
    await this.orderRepo.save(order);

    // 8. Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'created',
        newStatus: 'pending',
        notes: `Order created with ${items.length} items`,
      }),
    );

    // 9. Emit order.created event (Inventory will reserve and confirm stock)
    const orderCreatedEvent = {
      ...createBaseEvent('order.created', 'order-svc'),
      eventType: 'order.created',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        totalAmount: Number(order.totalAmount),
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.price),
        })),
        createdAt: order.createdAt,
      },
    };

    //console.log('[OrderSvc] Emitting order.created event:', orderCreatedEvent);
    this.kafka.emit('order.created', orderCreatedEvent);

    return order;
  }
  // Trong OrderSvcService
  async list(page: number = 1, limit: number = 10): Promise<Order[]> {
    return this.orderRepo.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  /**
   * Validate customer exists
   */
  private async validateCustomer(customerId: string): Promise<void> {
    console.log('[OrderSvc] validateCustomer called with customerId:', customerId);
    console.log('[OrderSvc] validateCustomer customerId type:', typeof customerId);
    console.log('[OrderSvc] Calling getCustomerById with payload:', JSON.stringify({ id: customerId }));
    try {
      const response: any = await firstValueFrom(
        this.customerService.getCustomerById({ id: customerId })
      );
      if (!response || !response.customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }
    } catch (error) {
      // Log full error to help debugging gRPC/internal failures
      debug.error('[OrderSvc] validateCustomer error:', error);

      if (error instanceof NotFoundException) throw error;

      // Check for gRPC NOT_FOUND error code
      if (error?.code === 5 || error?.details?.includes('not found')) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // If upstream gRPC call failed (network / unavailable service), surface a clearer message
      // so that API Gateway doesn't just return a vague INTERNAL error.
      const message = error?.details || error?.message || 'Failed to validate customer';
      throw new BadRequestException(`Failed to validate customer: ${message}`);
    }
  }

  /**
   * Validate products exist and return with actual prices from catalogue
   */
  private async validateProducts(items: Array<{ productId: string; quantity: number; price: number; notes?: string }>): Promise<ValidatedOrderItem[]> {
    const validatedItems: ValidatedOrderItem[] = [];
    
    for (const item of items) {
      try {
        debug.log(`[OrderSvc] validateProducts Checking product ${item.productId}...`);
        
        // Get product from catalogue
        const response: any = await firstValueFrom(
          this.catalogueService.getProductById({ id: item.productId })
        );
        debug.log(`[OrderSvc] validateProducts Catalogue response:`, response);

        if (!response || !response.product) {
          throw new NotFoundException(`Product ${item.productId} not found in catalogue`);
      }
      
        const product = response.product;

        // Use catalogue price (ignore client-provided price for security)
      validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(product.price), // Use price from catalogue
          notes: item.notes,
        });
        debug.log(`[OrderSvc] validateProducts Product ${item.productId} validated with price ${product.price}`);

      } catch (error) {
        debug.error(`[ERROR] validateProducts Error validating product ${item.productId}:`, error);
        if (error instanceof NotFoundException) throw error;
        throw new BadRequestException(`Failed to validate product ${item.productId}: ${error.message}`);
      }
    }

    return validatedItems;
  }

  /**
   * Validate inventory availability for all items before creating order
   * Throws UnprocessableEntityException (422) if any item is out of stock
   */
  private async validateInventory(items: ValidatedOrderItem[]): Promise<void> {
    const unavailableItems: Array<{
      productId: string;
      requestedQuantity: number;
      availableQuantity: number;
    }> = [];

    for (const item of items) {
      try {
        debug.log(`[OrderSvc] validateInventory Checking availability for product ${item.productId}, quantity ${item.quantity}...`);

        // Call inventory service to check stock availability
        const response: any = await firstValueFrom(
          this.inventoryService.checkAvailability({
            productId: item.productId,
            requestedQuantity: item.quantity
          })
        );

        debug.log(`[OrderSvc] validateInventory Response:`, response);

        // Check if stock is available
        if (!response.available) {
          unavailableItems.push({
            productId: item.productId,
            requestedQuantity: item.quantity,
            availableQuantity: response.availableQuantity || 0,
          });
          debug.warn(`[OrderSvc] validateInventory Product ${item.productId} is out of stock. Requested: ${item.quantity}, Available: ${response.availableQuantity}`);
        }

      } catch (error) {
        debug.error(`[ERROR] validateInventory Error checking availability for product ${item.productId}:`, error);
        // If inventory service is down or error, treat as unavailable
        unavailableItems.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
        });
      }
    }

    // If any items are unavailable, throw RPC error with OUT_OF_STOCK message
    if (unavailableItems.length > 0) {
      const errorMessage = `OUT_OF_STOCK: Cannot create order - ${unavailableItems.length} item(s) out of stock`;
      debug.error(`[OrderSvc] validateInventory ${errorMessage}`, unavailableItems);

      // Throw RpcException so the error message is properly transmitted via gRPC
      // The API Gateway will check for "OUT_OF_STOCK" in the error message
      throw new RpcException({
        code: 9, // gRPC FAILED_PRECONDITION
        message: errorMessage,
        details: {
          error: 'OUT_OF_STOCK',
          unavailableItems,
        },
      });
    }

    debug.log(`[OrderSvc] validateInventory All items have sufficient stock`);
  }

  async listByCustomer(customerId: string, page = 1, limit = 20): Promise<Order[]> {
    // Optimized query with pagination and index usage
    // Uses idx_orders_customer_created index for fast lookup
    const skip = (page - 1) * limit;
    
    return this.orderRepo.find({
      where: { customerId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: skip,
      // Select specific fields to reduce data transfer
      select: {
        id: true,
        customerId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        notes: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Alias for gRPC compatibility
  async getByCustomerId(customerId: string, page?: number, limit?: number): Promise<Order[]> {
    return this.listByCustomer(customerId, page, limit);
  }

  async getById(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  async getByOrderNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { orderNumber },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    return order;
  }

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.getById(id);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Cannot update order in ${order.status} status`,
      );
    }

    // Lưu trạng thái và dữ liệu trước khi update
    const previousStatus = order.status;
    const previousData = {
      notes: order.notes,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
    };

    // Update order - chỉ update các field được phép
    if (dto.notes !== undefined) order.notes = dto.notes;
    if (dto.shippingAddress !== undefined) order.shippingAddress = dto.shippingAddress;
    if (dto.billingAddress !== undefined) order.billingAddress = dto.billingAddress;

    const updated = await this.orderRepo.save(order);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        action: 'updated',
        previousStatus,
        newStatus: updated.status,
        notes: `Order updated: ${Object.keys(dto).filter(k => dto[k] !== undefined).join(', ')}`,
      }),
    );

    // Emit ORDER_UPDATED event
    this.kafka.emit('order.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'order.updated',
      timestamp: new Date(),
      source: 'order-svc',
      data: {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        customerId: updated.customerId,
        previousStatus,
        newStatus: updated.status,
        changes: {
          notes: dto.notes,
          shippingAddress: dto.shippingAddress,
          billingAddress: dto.billingAddress,
        },
        updatedAt: updated.updatedAt,
      },
    });

    //console.log(`[OrderSvc] Emitted ORDER_UPDATED event for order ${updated.orderNumber}`);

    return updated;
  }

  // ============= STATUS MANAGEMENT =============

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Order> {
    const order = await this.getById(id);
    const previousStatus = order.status;

    // Validate status transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    if (!(validTransitions[previousStatus as keyof typeof validTransitions] as string[]).includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${previousStatus} to ${dto.status}`,
      );
    }

    order.status = dto.status;
    const updated = await this.orderRepo.save(order);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        orderId: id,
        orderNumber: order.orderNumber,
        action: 'status_changed',
        previousStatus,
        newStatus: dto.status,
        notes: dto.notes,
      }),
    );

    this.kafka.emit('order.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'order.updated',
      timestamp: new Date(),
      source: 'order-svc',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        previousStatus,
        newStatus: dto.status,
        updatedAt: new Date(),
      },
    });

    // Emit specific event for order completed
    if (dto.status === 'delivered') {
      this.kafka.emit('order.completed', {
        eventId: crypto.randomUUID(),
        eventType: 'order.completed',
        timestamp: new Date(),
        source: 'order-svc',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          totalAmount: order.totalAmount,
          completedAt: new Date(),
        },
      });
    }

    if (dto.status === 'cancelled') {
      this.kafka.emit('order.cancelled', {
        eventId: crypto.randomUUID(),
        eventType: 'order.cancelled',
        timestamp: new Date(),
        source: 'order-svc',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          reason: dto.notes || 'No reason provided',
        },
      });
    }

    return updated;
  }

  // Cancel order shortcut method
  async cancel(id: string, reason?: string): Promise<Order> {
    return this.updateStatus(id, { 
      status: 'cancelled', 
      notes: reason || 'Order cancelled by customer' 
    });
  }

  // ============= ITEM MANAGEMENT =============

  async addItem(id: string, dto: AddItemDto): Promise<Order> {
    const order = await this.getById(id);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Cannot add items to order in ${order.status} status`,
      );
    }
    
    // Ensure numeric values
    const productId = dto.productId;
    const quantity = Number(dto.quantity);
    const price = Number(dto.price);
    
    // Check if product already in order
    const existingItem = order.items.find((i) => i.productId === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.subtotal = Number(existingItem.quantity) * Number(existingItem.price);
      await this.itemRepo.save(existingItem);
    } else {
      const newItem = await this.itemRepo.save(
        this.itemRepo.create({
          orderId: order.id,
          productId: productId,
          quantity: quantity,
          price: price,
          subtotal: price * quantity,
          notes: dto.notes,
        }),
      );
      order.items.push(newItem);
    }

    // Recalculate totals - ensure numeric conversion to avoid string concatenation
    order.subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );
    order.totalAmount = order.calculateTotal();
    const updated = await this.orderRepo.save(order);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        orderId: id,
        orderNumber: order.orderNumber,
        action: 'item_added',
        notes: `Added ${dto.quantity} x product ${dto.productId}`,
      }),
    );
    //console.log(`[OrderSvc] addItem Added item to order ${id}:`, dto)  ;
    return updated;
  }

  async deleteItem(id: string, itemId: string): Promise<Order> {
    const order = await this.getById(id);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Cannot remove items from order in ${order.status} status`,
      );
    }

    const item = order.items.find((i) => i.id === itemId);

    if (!item) {
      throw new NotFoundException(
        `Item ${itemId} not found in order ${id}`,
      );
    }

    await this.itemRepo.delete(itemId);

    // Recalculate totals - ensure numeric conversion to avoid string concatenation
    order.items = order.items.filter((i) => i.id !== itemId);
    order.subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );
    order.totalAmount = order.calculateTotal();
    const updated = await this.orderRepo.save(order);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        orderId: id,
        orderNumber: order.orderNumber,
        action: 'item_removed',
        notes: `Removed item ${itemId} (product ${item.productId})`,
      }),
    );

    return updated;
  }

  // ============= UTILITIES =============

  async getOrderHistory(id: string): Promise<OrderHistory[]> {
    return this.historyRepo.find({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    // Generate unique order number using timestamp + random suffix
    // This prevents race conditions during high-concurrency scenarios
    const timestamp = Date.now().toString(36).toUpperCase(); // Base36 timestamp
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 random chars
    
    return `ORD-${year}-${month}-${timestamp}-${randomSuffix}`;
  }

  async getOrderStats(customerId: string): Promise<any> {
    const orders = await this.orderRepo.find({
      where: { customerId },
      relations: ['items'],
    });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const totalItems = orders.reduce((sum, o) => sum + o.getItemCount(), 0);

    return {
      totalOrders,
      totalSpent: Number(totalSpent.toFixed(2)),
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
      totalItems,
    };
  }

  async getStats(): Promise<any> {
    const allOrders = await this.orderRepo.find({ relations: ['items'] });

    const totalOrders = allOrders.length;
    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const completedOrders = allOrders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = allOrders.filter(o => o.status === 'cancelled').length;

    return {
      totalOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
      pendingOrders,
      completedOrders,
      cancelledOrders,
    };
  }
}
