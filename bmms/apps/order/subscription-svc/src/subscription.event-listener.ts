import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { subscriptionSvcService } from './subscription-svc.service';
import { SubscriptionStatus } from './entities/subscription.entity';
import * as event from '@bmms/event';

@Controller()
export class SubscriptionEventListener {
  constructor(
    private readonly subscriptionService: subscriptionSvcService,
  ) {}

  /** -------- Payment Events -------- */
  
  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() eventData: event.PaymentSuccessEvent) {
    try {
      console.log('📥 [subscription-group] Received PAYMENT_SUCCESS event');
      this.logEvent(eventData);

      const { invoiceId, customerId } = eventData.data;

      console.log(`💳 Payment succeeded for invoice ${invoiceId}, customer ${customerId}`);

      // TODO: In the future, we can fetch invoice details to get subscriptionId
      // and activate the subscription here. For now, activation happens via direct API call.
      
    } catch (error) {
      console.error('❌ Error handling PAYMENT_SUCCESS:', error);
    }
  }

  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() eventData: event.PaymentFailedEvent) {
    try {
      console.log('📥 [subscription-group] Received PAYMENT_FAILED event');
      this.logEvent(eventData);

      const { invoiceId, customerId, reason } = eventData.data;

      console.log(`❌ Payment failed for invoice ${invoiceId}: ${reason}`);

      // TODO: If this is a subscription payment, mark subscription as past_due
      // This would require getting invoice details and checking subscriptionId
      // const invoice = await getInvoiceDetails(invoiceId);
      // if (invoice.subscriptionId) {
      //   await this.subscriptionService.updateStatus(
      //     invoice.subscriptionId,
      //     SubscriptionStatus.PAST_DUE,
      //     `Payment failed: ${reason}`
      //   );
      // }
      
    } catch (error) {
      console.error('❌ Error handling PAYMENT_FAILED:', error);
    }
  }

  @EventPattern(event.EventTopics.INVOICE_CREATED)
  async handleInvoiceCreated(@Payload() eventData: event.InvoiceCreatedEvent) {
    try {
      console.log('📥 [subscription-group] Received INVOICE_CREATED event');
      this.logEvent(eventData);

      const { invoiceId, invoiceNumber, customerId } = eventData.data;

      console.log(`📄 Invoice ${invoiceNumber} created for customer ${customerId}`);

      // TODO: Send notification to customer about new invoice
      
    } catch (error) {
      console.error('❌ Error handling INVOICE_CREATED:', error);
    }
  }

  /** -------- Scheduled Jobs / Cron Events -------- */
  
  /**
   * This would be called by a scheduler service to check for expiring trials
   */
  async checkExpiringTrials() {
    try {
      console.log('🔍 Checking for expiring trials...');
      
      // Find subscriptions on trial that are expiring soon (e.g., 3 days before end)
      // Send notifications to customers
      
    } catch (error) {
      console.error('❌ Error checking expiring trials:', error);
    }
  }

  /**
   * This would be called by a scheduler service to check for subscription renewals
   */
  async checkSubscriptionRenewals() {
    try {
      console.log('🔍 Checking for subscriptions to renew...');
      
      const subscriptions = await this.subscriptionService.findSubscriptionsToRenew();
      
      console.log(`Found ${subscriptions.length} subscriptions to renew`);
      
      for (const subscription of subscriptions) {
        console.log(`🔄 Renewing subscription ${subscription.id}`);
        await this.subscriptionService.renew(subscription.id);
      }
      
    } catch (error) {
      console.error('❌ Error checking subscription renewals:', error);
    }
  }

  /** -------- Helper Methods -------- */
  
  private logEvent<T extends { eventType: string; timestamp: Date | string }>(eventData: T) {
    const timestamp = typeof eventData.timestamp === 'string'
      ? new Date(eventData.timestamp).toISOString()
      : eventData.timestamp.toISOString();

    console.log(
      `🔥 [SUBSCRIPTION] Received event [${eventData.eventType}] at ${timestamp}`,
    );
  }
}
