import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import * as event from '@bmms/event';
import { OrderSvcService } from './order-svc.service';
import { CustomerSvcService } from 'apps/customer/customer-svc/src/customer-svc.service';


@Controller()
export class OrderEventListener {
  constructor(
    private readonly customerSvcService: CustomerSvcService,
    private readonly orderSvcService: OrderSvcService,
  ) {}

  /** ------------------- Customer Events ------------------- */

  @EventPattern(event.EventTopics.CUSTOMER_CREATED)
  async handleCustomerCreated(@Payload() event: any) {
    try {
      this.logEvent(event);
         console.log('📨 RAW EVENT RECEIVED:', JSON.stringify(event, null, 2));

      // TODO: Implement business logic
      // e.g., create welcome voucher, send welcome email
      // await this.customerService.createWelcomeVoucher(event.data.customerId);
      // await this.customerService.sendWelcomeEmail(event.data.email);

    } catch (error) {
      console.error('Error handling CUSTOMER_CREATED event:', error);
    }
  }

  @EventPattern(event.EventTopics.CUSTOMER_UPDATED)
  async handleCustomerUpdated(@Payload() event: event.CustomerUpdatedEvent) {
    try {
      this.logEvent(event);

      // TODO: Implement business logic
      // e.g., update local cache, notify other services
      // await this.customerService.handleCustomerUpdate(event.data.customerId, event.data.changes);

    } catch (error) {
      console.error('Error handling CUSTOMER_UPDATED event:', error);
    }
  }

  /** -------- Inventory Events -------- */

  @EventPattern(event.EventTopics.INVENTORY_RESERVED)
  async handleInventoryReserved(@Payload() event: any) {
    try {
      this.logEvent(event);
      const { orderId } = event.data;
      // TODO: Mark order as "stock confirmed" if all items reserved
      console.log(`✅ Inventory reserved for order ${orderId}`);
    } catch (error) {
      console.error('❌ Error handling INVENTORY_RESERVED:', error);
    }
  }

  @EventPattern(event.EventTopics.INVENTORY_RELEASED)
  async handleInventoryReleased(@Payload() event: event.InventoryReleasedEvent) {
    try {
      this.logEvent(event);
      const { orderId, reason } = event.data;
      
      if (reason === 'order_cancelled') {
        // await this.orderService.updateStatus(orderId, 'cancelled');
        console.log(`📦 Inventory released for cancelled order ${orderId}`);
      }
    } catch (error) {
      console.error('❌ Error handling INVENTORY_RELEASED:', error);
    }
  }

  /** ------------------- Payment Events ------------------- */

  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() event: event.PaymentSuccessEvent) {
    try {
      this.logEvent(event);

      const { orderId, transactionId } = event.data;

      // Update order status
      //await this.orderSvcService.updateOrderStatus(orderId, 'PAID');

      console.log(`✅ Order ${orderId} marked as PAID with transaction ${transactionId}`);

    } catch (error) {
      console.error('Error handling PAYMENT_SUCCESS event:', error);
    }
  }
  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event:event.PaymentFailedEvent) {
    try {
      this.logEvent(event);
      const { orderId, reason } = event.data;

      // Send notification to customer about payment failure
      // await this.notificationService.sendPaymentFailureAlert(orderId, reason);

      console.log(`❌ Payment failed for order ${orderId}: ${reason}`);
    } catch (error) {
      console.error('❌ Error handling PAYMENT_FAILED:', error);
    }
  }


  /** ------------------- Helper ------------------- */
  private logEvent<T extends { eventType: string }>(event: T) {
    console.log(`📥 Received event [${event.eventType}] at ${new Date().toISOString()}:`, event);
  }
}