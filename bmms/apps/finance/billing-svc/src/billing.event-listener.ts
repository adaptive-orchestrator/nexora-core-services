import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { BillingService } from './billing-svc.service';
import * as event from '@bmms/event';


@Controller()
export class BillingEventListener {
  constructor(
    private readonly billingService: BillingService,
    //private readonly notificationService: NotificationService,
  ) { }

  /** -------- Order Events -------- */
  @EventPattern(event.EventTopics.ORDER_CREATED) // ← EventTopics.ORDER_CREATED = 'order.created'
  async handleOrderCreated(@Payload() event: event.OrderCreatedEvent) {
    try {
      console.log('📥 [billing-group] Received ORDER_CREATED event');
      console.log('📦 Order ID:', event.data.orderId);

      this.logEvent(event);
     const { orderId, orderNumber, customerId, items, totalAmount } = event.data;

      // Auto-create invoice from order
      await this.billingService.create({
        orderId,
        orderNumber,
        customerId,
        items: items.map(item => ({
          productId: item.productId,
          description: `Product ${item.productId}`,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.quantity * item.price,
        })),
        subtotal: totalAmount,
        tax: 0,
        totalAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      console.log(`✅ Invoice created for order ${orderId}`);
    } catch (error) {
      console.error('❌ Error handling ORDER_CREATED:', error);
    }
  }

  /** -------- Payment Events -------- */

  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() event: event.PaymentSuccessEvent) {
    try {
      this.logEvent(event);
      const { amount } = event.data;

      // Send payment receipt to customer
      // await this.notificationService.sendPaymentReceipt(customerId, invoiceNumber, amount);

      console.log(`✅ Payment receipt sent for invoice `);
    } catch (error) {
      console.error('❌ Error handling PAYMENT_SUCCESS:', error);
    }
  }

  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event: event.PaymentFailedEvent) {
    try {
      this.logEvent(event);
      const { orderId, reason } = event.data;

      // Send payment failure notification
      // await this.notificationService.sendPaymentFailureNotice(orderId, reason);

      console.log(`❌ Payment failure notice sent for order ${orderId}`);
    } catch (error) {
      console.error('❌ Error handling PAYMENT_FAILED:', error);
    }
  }

  @EventPattern(event.EventTopics.INVOICE_OVERDUE)
  async handleInvoiceOverdue(@Payload() event: any) {
    try {
      this.logEvent(event);
      const { invoiceNumber, customerId, dueAmount } = event.data;

      // Send overdue payment reminder
      // await this.notificationService.sendOverdueReminder(customerId, invoiceNumber, dueAmount);

      console.log(`⚠️ Overdue reminder sent for invoice ${invoiceNumber}`);
    } catch (error) {
      console.error('❌ Error handling INVOICE_OVERDUE:', error);
    }
  }

  /** -------- Helper Methods -------- */
  /** -------- Helper Methods -------- */
  private logEvent<T extends { eventType: string; timestamp: Date | string }>(event: T) {
    const timestamp = typeof event.timestamp === 'string'
      ? new Date(event.timestamp).toISOString()
      : event.timestamp.toISOString();

    console.log(
      `🔥 [BILLING] Received event [${event.eventType}] at ${timestamp}`,
    );
  }
}
