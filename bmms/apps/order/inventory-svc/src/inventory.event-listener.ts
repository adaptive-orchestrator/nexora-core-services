import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import * as event from '@bmms/event';
import { debug } from '@bmms/common';
import { InventoryService } from './inventory-svc.service';

@Controller()
export class InventoryEventListener {
  constructor(
    private readonly inventoryService: InventoryService,
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

      const { id: productId, name } = eventData;

      debug.log(`📦 [INVENTORY] Processing PRODUCT_CREATED for product: ${name} (ID: ${productId})`);

      // Create initial inventory record (with duplicate check)
      const inventory = await this.inventoryService.createInventoryForProduct(productId, 0, 10);

      if (inventory.createdAt.getTime() === inventory.updatedAt.getTime()) {
        debug.log(`✅ Inventory initialized for new product: ${name} (ID: ${productId})`);
      } else {
        debug.log(`ℹ️ Inventory already existed for product: ${name} (ID: ${productId}), skipped creation`);
      }
    } catch (error) {
      // Only log non-duplicate errors
      if (error.code !== 'ER_DUP_ENTRY') {
        debug.error('❌ Error handling PRODUCT_CREATED:', error);
      }
    }
  }

  /** -------- Order Events -------- */

  @EventPattern(event.EventTopics.ORDER_CREATED)
  async handleOrderCreated(@Payload() event: event.OrderCreatedEvent) {
    try {
      this.logEvent(event);
      const { orderId, orderNumber, items, customerId } = event.data;

      debug.log(`[Inventory] Processing inventory reservation for order ${orderNumber} (ID: ${orderId})`);

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
            customerId,
          );

          reservations.push(reservation);
          reservedItems.push({
            productId,
            quantity,
            reservationId: reservation.id,
          });

          debug.log(`[Inventory] Reserved ${quantity} units of product ${productId} for order ${orderNumber}`);
        } catch (error) {
          debug.error(`[ERROR] Failed to reserve product ${productId} for order ${orderNumber}:`, error.message);
          
          // Compensation: Release already reserved items
          if (reservedItems.length > 0) {
            debug.log(`[Inventory] Rolling back ${reservedItems.length} reservations...`);
            try {
              await this.inventoryService.releaseReservations(orderId, 'reservation_failed');
            } catch (rollbackError) {
              debug.error('[ERROR] Failed to rollback reservations:', rollbackError);
            }
          }
          
          // Log failure (Order service should handle timeout and update status)
          debug.error(`[ERROR] Reservation failed for order ${orderNumber}. Order service should handle this.`);
          
          throw error;
        }
      }

      debug.log(`[Inventory] All inventory reserved successfully for order ${orderNumber}`);
      debug.log(`[Inventory] Total reservations: ${reservations.length}, Total items: ${reservedItems.length}`);
      
      // Note: Individual inventory.reserved events already emitted by reserveStock()
      // Billing service will listen to those events
      
    } catch (error) {
      debug.error('[ERROR] Error handling ORDER_CREATED:', error);
      // Error already logged and compensation already executed
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