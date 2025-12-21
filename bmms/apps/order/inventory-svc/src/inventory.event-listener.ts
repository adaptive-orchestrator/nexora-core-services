import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload, ClientKafka } from '@nestjs/microservices';
import * as event from '@bmms/event';
import { debug } from '@bmms/common';
import { InventoryService } from './inventory-svc.service';

interface UnavailableItem {
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
  reason: string;
}

@Controller()
export class InventoryEventListener {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  /** -------- Product Events -------- */

  @EventPattern(event.EventTopics.PRODUCT_CREATED)
  async handleProductCreated(@Payload() payload: any) {
    try {
      // Handle both wrapped event format and direct data format from Kafka
      const eventData = payload?.data || payload?.value?.data || payload;

      if (!eventData || !eventData.id) {
        debug.log('[WARNING] PRODUCT_CREATED event missing data, skipping:', JSON.stringify(payload));
        return;
      }

      const { id: productId, name, ownerId } = eventData;

      debug.log(`📦 [INVENTORY] Processing PRODUCT_CREATED for product: ${name} (ID: ${productId}, Owner: ${ownerId || 'none'})`);

      // Create initial inventory record WITH ownerId from product event
      // This ensures inventory is created for the correct owner
      const inventory = await this.inventoryService.createInventoryForProduct(
        productId, 
        0, // Initial quantity
        10, // Default reorder level
        undefined, // warehouseLocation
        undefined, // maxStock
        ownerId // Pass ownerId from product event
      );

      if (inventory.createdAt.getTime() === inventory.updatedAt.getTime()) {
        debug.log(`✅ Inventory initialized for new product: ${name} (ID: ${productId}, Owner: ${ownerId || 'none'})`);
      } else {
        debug.log(`ℹ️ Inventory already existed for product: ${name} (ID: ${productId}), skipped creation`);
      }
    } catch (error) {
      // Only log non-duplicate errors
      if (error.code !== 'ER_DUP_ENTRY' && error.code !== '23505') {
        debug.error('❌ Error handling PRODUCT_CREATED:', error);
      }
    }
  }

  /** -------- Order Events -------- */

  @EventPattern(event.EventTopics.ORDER_CREATED)
  async handleOrderCreated(@Payload() evt: event.OrderCreatedEvent) {
    const startTime = Date.now();
    let orderId: string | undefined;
    let orderNumber: string | undefined;
    let customerId: string | undefined;
    const unavailableItems: UnavailableItem[] = [];

    try {
      this.logEvent(evt);
      
      // Extract data from event (handle both wrapped and direct formats)
      const eventData = (evt as any)?.data || (evt as any)?.value?.data || evt;
      orderId = eventData?.orderId;
      orderNumber = eventData?.orderNumber;
      customerId = eventData?.customerId;
      const items = eventData?.items || [];

      if (!orderId || !orderNumber) {
        debug.error('[Inventory] ORDER_CREATED missing orderId or orderNumber');
        return;
      }

      debug.log(`[Inventory] 📦 Processing inventory reservation for order ${orderNumber} (ID: ${orderId})`);
      debug.log(`[Inventory] Items to reserve: ${items.length}`);

      const reservations: any[] = [];
      const reservedItems: Array<{ productId: string; quantity: number; reservationId: string }> = [];

      // Reserve inventory for each item in order
      for (const item of items) {
        const { productId, quantity } = item;

        try {
          // Reserve stock (this already emits individual inventory.reserved events)
          const reservation = await this.inventoryService.reserveStock(
            productId,
            quantity,
            orderId,
            customerId!,
          );

          reservations.push(reservation);
          reservedItems.push({
            productId,
            quantity,
            reservationId: reservation.id,
          });

          debug.log(`[Inventory] ✅ Reserved ${quantity} units of product ${productId} for order ${orderNumber}`);
        } catch (error: any) {
          debug.error(`[Inventory] ❌ Failed to reserve product ${productId} for order ${orderNumber}:`, error.message);
          
          // Track unavailable item details
          unavailableItems.push({
            productId,
            requestedQuantity: quantity,
            availableQuantity: 0, // Will be updated if we can determine actual available
            reason: error.message || 'RESERVATION_ERROR',
          });

          // Compensation: Release already reserved items
          if (reservedItems.length > 0) {
            debug.log(`[Inventory] 🔄 Rolling back ${reservedItems.length} reservations for order ${orderNumber}...`);
            try {
              await this.inventoryService.releaseReservations(orderId, 'reservation_failed');
              debug.log(`[Inventory] ✅ Rollback completed for order ${orderNumber}`);
            } catch (rollbackError) {
              debug.error('[Inventory] ❌ Failed to rollback reservations:', rollbackError);
            }
          }

          // Emit inventory.reserve_failed event to notify Order Service
          const reserveFailedEvent = {
            ...event.createBaseEvent('inventory.reserve_failed', 'inventory-svc'),
            eventType: 'inventory.reserve_failed',
            data: {
              orderId,
              orderNumber,
              customerId,
              reason: 'OUT_OF_STOCK',
              unavailableItems: unavailableItems.map(item => ({
                productId: item.productId,
                requestedQuantity: item.requestedQuantity,
                availableQuantity: item.availableQuantity,
              })),
              failedAt: new Date().toISOString(),
            },
          };

          debug.log(`[Inventory] 📤 Emitting inventory.reserve_failed for order ${orderNumber}`);
          debug.log(`[Inventory] Event payload:`, JSON.stringify(reserveFailedEvent, null, 2));
          
          this.kafka.emit(event.EventTopics.INVENTORY_RESERVE_FAILED, reserveFailedEvent);

          // Stop processing remaining items
          return;
        }
      }

      const duration = Date.now() - startTime;
      debug.log(`[Inventory] ✅ All inventory reserved successfully for order ${orderNumber} in ${duration}ms`);
      debug.log(`[Inventory] Total reservations: ${reservations.length}, Total items: ${reservedItems.length}`);
      
      // Note: Individual inventory.reserved events already emitted by reserveStock()
      // Order service will receive INVENTORY_RESERVED events and proceed with payment
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      debug.error(`[Inventory] ❌ Error handling ORDER_CREATED for order ${orderId} after ${duration}ms:`, error);
      debug.error('[Inventory] Error stack:', error?.stack);

      // Emit reserve_failed for any unhandled error
      if (orderId) {
        const reserveFailedEvent = {
          ...event.createBaseEvent('inventory.reserve_failed', 'inventory-svc'),
          eventType: 'inventory.reserve_failed',
          data: {
            orderId,
            orderNumber: orderNumber || 'UNKNOWN',
            customerId: customerId || 'UNKNOWN',
            reason: 'RESERVATION_ERROR',
            unavailableItems,
            errorMessage: error?.message || 'Unknown error during reservation',
            failedAt: new Date().toISOString(),
          },
        };

        debug.log(`[Inventory] 📤 Emitting inventory.reserve_failed (error fallback) for order ${orderId}`);
        this.kafka.emit(event.EventTopics.INVENTORY_RESERVE_FAILED, reserveFailedEvent);
      }
    }
  }

  @EventPattern(event.EventTopics.INVENTORY_RELEASE_REQUEST)
  async handleInventoryReleaseRequest(@Payload() evt: any) {
    try {
      debug.log('[Inventory] 📥 INVENTORY_RELEASE_REQUEST received');
      
      // Extract data from event
      const eventData = evt?.data || evt?.value?.data || evt;
      const { orderId, reason } = eventData;

      if (!orderId) {
        debug.error('[Inventory] INVENTORY_RELEASE_REQUEST missing orderId');
        return;
      }

      debug.log(`[Inventory] 🔄 Processing release request for order ${orderId} (reason: ${reason})`);

      // Release all reservations for the order
      await this.inventoryService.releaseReservations(orderId, reason || 'release_request');

      debug.log(`[Inventory] ✅ Inventory released for order ${orderId}`);

    } catch (error: any) {
      debug.error('[Inventory] ❌ Error handling INVENTORY_RELEASE_REQUEST:', error);
    }
  }

  @EventPattern(event.EventTopics.ORDER_COMPLETED)
  async handleOrderCompleted(@Payload() event: event.OrderCompletedEvent) {
    try {
      this.logEvent(event);
      const { orderId } = event.data;

      // Complete all reservations for order (convert reserved -> actual deduction)
      await this.inventoryService.completeReservations(orderId);

      debug.log(`[Inventory] Completed inventory reservations for order ${orderId}`);
    } catch (error) {
      debug.error('[ERROR] Error handling ORDER_COMPLETED:', error);
    }
  }

  @EventPattern(event.EventTopics.ORDER_CANCELLED)
  async handleOrderCancelled(@Payload() event: event.OrderCancelledEvent) {
    try {
      this.logEvent(event);
      const { orderId, reason } = event.data;

      // Release all reserved inventory back to available stock
      await this.inventoryService.releaseReservations(orderId, 'order_cancelled');

      debug.log(`[Inventory] Released inventory for cancelled order ${orderId} (Reason: ${reason})`);
    } catch (error) {
      debug.error('[ERROR] Error handling ORDER_CANCELLED:', error);
    }
  }

   private logEvent<T extends { eventType: string; timestamp?: Date | string }>(event: T) {
    let timestamp: string;
    if (!event.timestamp) {
      timestamp = new Date().toISOString();
    } else if (typeof event.timestamp === 'string') {
      timestamp = new Date(event.timestamp).toISOString();
    } else {
      timestamp = event.timestamp.toISOString();
    }

    debug.log(
      `[Inventory] Received event [${event.eventType}] at ${timestamp}`,
    );
  }
}