import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { BillingService } from './billing-svc.service';
import * as event from '@bmms/event';

interface IOrderGrpcService {
  getOrderById(data: { id: string }): any;
}

@Controller()
export class BillingEventListener implements OnModuleInit {
  // Track reserved items by orderId for aggregation
  private orderReservations: Map<string, Array<{
    productId: string;
    quantity: number;
    reservationId: string;
  }>> = new Map();

  private orderService: IOrderGrpcService;

  constructor(
    private readonly billingService: BillingService,
    @Inject('ORDER_PACKAGE')
    private readonly orderClient: ClientGrpc,
    //private readonly notificationService: NotificationService,
  ) { }

  onModuleInit() {
    this.orderService = this.orderClient.getService<IOrderGrpcService>('OrderService');
  }

  /** -------- Inventory Events -------- */
  @EventPattern(event.EventTopics.INVENTORY_RESERVED)
  async handleInventoryReserved(@Payload() event: event.InventoryReservedEvent) {
    try {
      console.log('[BillingEvent] Received INVENTORY_RESERVED event');
      this.logEvent(event);

      const { reservationId, productId, quantity, orderId, customerId } = event.data;

      console.log(`[BillingEvent] Inventory reserved:`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Product ID: ${productId}`);
      console.log(`   Quantity: ${quantity}`);
      console.log(`   Reservation ID: ${reservationId}`);

      // Store reservation for this order
      if (!this.orderReservations.has(orderId)) {
        this.orderReservations.set(orderId, []);
      }

      this.orderReservations.get(orderId)!.push({
        productId,
        quantity,
        reservationId,
      });

      console.log(`[BillingEvent] Current reservations for order ${orderId}: ${this.orderReservations.get(orderId)!.length} items`);

      // Note: We need to check if all items for this order are reserved
      // This requires knowing the expected item count from the original order
      // For now, we'll create invoice after a short delay to allow all reservations to arrive
      // In production, you might want to:
      // 1. Store expected item count from order.created event
      // 2. Check if all items are reserved before creating invoice
      // 3. Or use a saga pattern with explicit coordination

      // For simplicity, we'll wait 2 seconds and then create invoice
      // (assuming all inventory.reserved events arrive within this window)
      setTimeout(async () => {
        await this.tryCreateInvoiceForOrder(orderId, customerId);
      }, 2000);

    } catch (error) {
      console.error('[BillingEvent] Error handling INVENTORY_RESERVED:', error);
    }
  }

  /**
   * Try to create invoice if all reservations for order are ready
   */
  private async tryCreateInvoiceForOrder(orderId: string, customerId: string) {
    try {
      const reservations = this.orderReservations.get(orderId);
      
      if (!reservations || reservations.length === 0) {
        console.log(`[BillingEvent] No reservations found for order ${orderId}`);
        return;
      }

      console.log(`[BillingEvent] Creating invoice for order ${orderId} with ${reservations.length} items`);

      // Fetch order details from Order Service via gRPC
      let orderDetails: any;
      try {
        const response: any = await firstValueFrom(
          this.orderService.getOrderById({ id: orderId })
        );
        orderDetails = response.order;
        console.log(`[BillingEvent] Fetched order details for order ${orderId}:`, {
          orderNumber: orderDetails.orderNumber,
          customerId: orderDetails.customerId,
          totalAmount: orderDetails.totalAmount,
          itemCount: orderDetails.items?.length || 0,
        });
      } catch (error) {
        console.error(`[BillingEvent] Failed to fetch order ${orderId} from Order Service:`, error.message);
        // Fallback to basic invoice creation
        orderDetails = {
          orderNumber: `ORD-${Date.now()}-${orderId}`,
          customerId,
          subtotal: 0,
          tax: 0,
          totalAmount: 0,
          items: [],
        };
      }

      // Use order details if available, otherwise calculate from reservations
      const items = orderDetails.items?.length > 0
        ? orderDetails.items.map((item: any) => ({
            productId: item.productId,
            description: item.notes || `Product ${item.productId}`,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.subtotal || (item.quantity * item.price),
          }))
        : reservations.map(item => ({
            productId: item.productId,
            description: `Product ${item.productId}`,
            quantity: item.quantity,
            unitPrice: 100, // Placeholder
            totalPrice: item.quantity * 100,
          }));

      const subtotal = orderDetails.subtotal || items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
      const tax = orderDetails.tax || (subtotal * 0.1);
      const shippingCost = orderDetails.shippingCost || 0;
      const discount = orderDetails.discount || 0;
      const totalAmount = orderDetails.totalAmount || (subtotal + tax + shippingCost - discount);

      // Create invoice
      const invoice = await this.billingService.create({
        orderId,
        orderNumber: orderDetails.orderNumber,
        customerId: orderDetails.customerId,
        items,
        subtotal,
        tax,
        shippingCost,
        discount,
        totalAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      console.log(`[BillingEvent] Invoice created for order ${orderId}:`, {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        itemCount: items.length,
      });

      // Clean up reservations from memory
      this.orderReservations.delete(orderId);

      // Note: invoice.created event is already emitted by billingService.create()
      // Payment service will listen to that event

    } catch (error) {
      console.error(`[BillingEvent] Error creating invoice for order ${orderId}:`, error);
    }
  }

  /** -------- Order Events -------- */
  
  // NOTE: We no longer create invoice on ORDER_CREATED
  // Instead, we wait for INVENTORY_RESERVED events to ensure stock is available
  // before generating invoices
  
  // @EventPattern(event.EventTopics.ORDER_CREATED)
  // async handleOrderCreated(@Payload() event: event.OrderCreatedEvent) {
  //   // Disabled - using INVENTORY_RESERVED instead
  // }

  @EventPattern(event.EventTopics.ORDER_UPDATED)
  async handleOrderUpdated(@Payload() event: event.OrderUpdatedEvent) {
    try {
      console.log('[BillingEvent] Received ORDER_UPDATED event');
      this.logEvent(event);
      
      const { orderId, orderNumber, customerId, previousStatus, newStatus, updatedAt } = event.data;

      console.log(`[BillingEvent] Order ${orderNumber} updated:`);
      console.log(`   Customer: ${customerId}`);
      console.log(`   Status: ${previousStatus} → ${newStatus}`);
      console.log(`   Updated at: ${updatedAt}`);

      // Nếu order bị cancelled, có thể cần void invoice
      if (newStatus === 'cancelled') {
        console.log(`[BillingEvent] Order ${orderNumber} cancelled - considering invoice void`);
        // await this.billingService.voidInvoiceByOrderId(orderId);
      }

      // Nếu order completed, có thể trigger reminder
      if (newStatus === 'completed') {
        console.log(`[BillingEvent] Order ${orderNumber} completed - checking invoice payment status`);
        // await this.billingService.sendPaymentReminderIfUnpaid(orderId);
      }

    } catch (error) {
      console.error('[BillingEvent] Error handling ORDER_UPDATED:', error);
    }
  }
  /** -------- Payment Events -------- */

  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() event: event.PaymentSuccessEvent) {
    try {
      this.logEvent(event);
      const { invoiceId, paymentId, amount, transactionId, customerId, orderId } = event.data;

      console.log(`[BillingEvent] Payment successful for invoice ${invoiceId}`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   Order ID: ${orderId || 'N/A'}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Transaction ID: ${transactionId}`);

      // 1. Update invoice status to 'paid'
      await this.billingService.updateInvoiceStatus(invoiceId, 'paid');
      console.log(`[BillingEvent] Invoice ${invoiceId} marked as PAID`);

      // 2. If there's an orderId, emit ORDER_COMPLETED event for inventory to deduct stock
      if (orderId) {
        await this.billingService.emitOrderCompleted(orderId, invoiceId);
        console.log(`[BillingEvent] ORDER_COMPLETED event emitted for order ${orderId}`);
      }

      // TODO: Send payment receipt to customer
      // await this.notificationService.sendPaymentReceipt(customerId, invoiceId, amount, transactionId);

      console.log(`[BillingEvent] Payment receipt sent for invoice ${invoiceId}`);
    } catch (error) {
      console.error('[BillingEvent] Error handling PAYMENT_SUCCESS:', error);
    }
  }

  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event: event.PaymentFailedEvent) {
    try {
      this.logEvent(event);
      const { orderId, reason } = event.data;

      // Send payment failure notification
      // await this.notificationService.sendPaymentFailureNotice(orderId, reason);

      console.log(`[BillingEvent] Payment failure notice sent for order ${orderId}`);
    } catch (error) {
      console.error('[BillingEvent] Error handling PAYMENT_FAILED:', error);
    }
  }

  @EventPattern(event.EventTopics.INVOICE_OVERDUE)
  async handleInvoiceOverdue(@Payload() event: any) {
    try {
      this.logEvent(event);
      const { invoiceNumber, customerId, dueAmount } = event.data;

      // Send overdue payment reminder
      // await this.notificationService.sendOverdueReminder(customerId, invoiceNumber, dueAmount);

      console.log(`[BillingEvent] Overdue reminder sent for invoice ${invoiceNumber}`);
    } catch (error) {
      console.error('[BillingEvent] Error handling INVOICE_OVERDUE:', error);
    }
  }

  /** -------- Subscription Events -------- */
  
  @EventPattern(event.EventTopics.SUBSCRIPTION_CREATED)
  async handleSubscriptionCreated(@Payload() event: event.SubscriptionCreatedEvent) {
    try {
      console.log('[BillingEvent] Received SUBSCRIPTION_CREATED event');
      this.logEvent(event);

      const { 
        subscriptionId, 
        customerId, 
        planName, 
        amount, 
        currentPeriodStart, 
        currentPeriodEnd,
        status 
      } = event.data;

      console.log(`[BillingEvent] Subscription Details:`);
      console.log(`   Subscription ID: ${subscriptionId}`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Plan: ${planName}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Status: ${status}`);

      // Only create invoice if not on trial
      if (status !== 'trial') {
        // Calculate due date (typically 7 days from period start)
        const dueDate = new Date(currentPeriodStart);
        dueDate.setDate(dueDate.getDate() + 7);

        await this.billingService.createRecurringInvoice({
          subscriptionId,
          customerId,
          planName,
          amount,
          periodStart: new Date(currentPeriodStart),
          periodEnd: new Date(currentPeriodEnd),
          dueDate,
        });

        console.log(`[BillingEvent] Recurring invoice created for subscription ${subscriptionId}`);
      } else {
        console.log(`[INFO] Subscription ${subscriptionId} is on trial, invoice will be created after trial`);
      }
    } catch (error) {
      console.error('[BillingEvent] Error handling SUBSCRIPTION_CREATED:', error);
    }
  }

  @EventPattern(event.EventTopics.SUBSCRIPTION_RENEWED)
  async handleSubscriptionRenewed(@Payload() event: event.SubscriptionRenewedEvent) {
    try {
      console.log('[BillingEvent] Received SUBSCRIPTION_RENEWED event');
      this.logEvent(event);

      const { 
        subscriptionId, 
        customerId, 
        planId, 
        currentPeriodStart, 
        currentPeriodEnd, 
        amount 
      } = event.data;

      console.log(`[BillingEvent] Subscription ${subscriptionId} renewed`);

      // Get plan name (you might want to call catalogue service here)
      const planName = `Plan #${planId}`;

      // Calculate due date
      const dueDate = new Date(currentPeriodStart);
      dueDate.setDate(dueDate.getDate() + 7);

      await this.billingService.createRecurringInvoice({
        subscriptionId,
        customerId,
        planName,
        amount,
        periodStart: new Date(currentPeriodStart),
        periodEnd: new Date(currentPeriodEnd),
        dueDate,
      });

      console.log(`[BillingEvent] Renewal invoice created for subscription ${subscriptionId}`);
    } catch (error) {
      console.error('[BillingEvent] Error handling SUBSCRIPTION_RENEWED:', error);
    }
  }

  @EventPattern(event.EventTopics.SUBSCRIPTION_TRIAL_ENDED)
  async handleSubscriptionTrialEnded(@Payload() event: event.SubscriptionTrialEndedEvent) {
    try {
      console.log('[BillingEvent] Received SUBSCRIPTION_TRIAL_ENDED event');
      this.logEvent(event);

      const { subscriptionId, customerId, planId, convertedToActive } = event.data;

      if (convertedToActive) {
        console.log(`[BillingEvent] Trial ended for subscription ${subscriptionId}, creating first invoice`);
        
        // TODO: Fetch subscription details to create invoice
        // You might want to call subscription service here to get current period details
        
        console.log(`[BillingEvent] First invoice will be created for subscription ${subscriptionId}`);
      }
    } catch (error) {
      console.error('[BillingEvent] Error handling SUBSCRIPTION_TRIAL_ENDED:', error);
    }
  }

  /** -------- Helper Methods -------- */
  private logEvent<T extends { eventType: string; timestamp: Date | string }>(event: T) {
    const timestamp = typeof event.timestamp === 'string'
      ? new Date(event.timestamp).toISOString()
      : event.timestamp.toISOString();

    console.log(
      `[BillingEvent] Received event [${event.eventType}] at ${timestamp}`,
    );
  }
}
