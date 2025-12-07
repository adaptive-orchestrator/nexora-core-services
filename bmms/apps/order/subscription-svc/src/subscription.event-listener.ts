import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { subscriptionSvcService } from './subscription-svc.service';
import { SubscriptionStatus } from './entities/subscription.entity';
import * as event from '@bmms/event';

// Interface for subscription payment event (custom event from payment-svc)
interface SubscriptionPaymentSuccessEvent {
  eventId: string;
  eventType: string;
  timestamp: Date | string;
  source: string;
  data: {
    paymentId: string;
    subscriptionId: string;
    customerId: string;
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    planName?: string;
    paidAt: Date | string;
  };
}

interface SubscriptionPaymentFailedEvent {
  eventId: string;
  eventType: string;
  timestamp: Date | string;
  source: string;
  data: {
    subscriptionId: string;
    customerId: string;
    amount: number;
    reason: string;
    canRetry: boolean;
  };
}

@Controller()
export class SubscriptionEventListener {
  constructor(
    private readonly subscriptionService: subscriptionSvcService,
  ) {}

  /** -------- Payment Events -------- */
  
  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() eventData: event.PaymentSuccessEvent) {
    try {
      console.log('[SubscriptionEvent] Received PAYMENT_SUCCESS event');
      this.logEvent(eventData);

      const { invoiceId, customerId } = eventData.data;

      console.log(`[SubscriptionEvent] Payment succeeded for invoice ${invoiceId}, customer ${customerId}`);

      // TODO: In the future, we can fetch invoice details to get subscriptionId
      // and activate the subscription here. For now, activation happens via direct API call.
      
    } catch (error) {
      console.error('[SubscriptionEvent] Error handling PAYMENT_SUCCESS:', error);
    }
  }

  /** -------- Subscription Payment Events (from payment-svc direct API) -------- */

  @EventPattern('subscription.payment.success')
  async handleSubscriptionPaymentSuccess(@Payload() eventData: SubscriptionPaymentSuccessEvent) {
    try {
      console.log('[SubscriptionEvent] Received subscription.payment.success event');
      this.logEvent(eventData);

      const { subscriptionId, customerId, amount, transactionId, planName } = eventData.data;

      console.log(`[SubscriptionEvent] Subscription payment succeeded:`);
      console.log(`   Subscription ID: ${subscriptionId}`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Transaction: ${transactionId}`);
      console.log(`   Plan: ${planName || 'N/A'}`);

      // Activate subscription
      try {
        await this.subscriptionService.activateSubscription(subscriptionId);
        console.log(`[SubscriptionEvent] Subscription ${subscriptionId} activated successfully`);
      } catch (activateError) {
        console.error(`[SubscriptionEvent] Failed to activate subscription ${subscriptionId}:`, activateError.message);
        // Still log success because payment was received
      }
      
    } catch (error) {
      console.error('[SubscriptionEvent] Error handling subscription.payment.success:', error);
    }
  }

  @EventPattern('subscription.payment.failed')
  async handleSubscriptionPaymentFailed(@Payload() eventData: SubscriptionPaymentFailedEvent) {
    try {
      console.log('[SubscriptionEvent] Received subscription.payment.failed event');
      this.logEvent(eventData);

      const { subscriptionId, customerId, amount, reason, canRetry } = eventData.data;

      console.log(`[SubscriptionEvent] Subscription payment failed:`);
      console.log(`   Subscription ID: ${subscriptionId}`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Can Retry: ${canRetry}`);

      // Optionally mark subscription as payment_failed if it exists
      // This is useful for retry logic
      
    } catch (error) {
      console.error('[SubscriptionEvent] Error handling subscription.payment.failed:', error);
    }
  }

  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() eventData: event.PaymentFailedEvent) {
    try {
      console.log('[SubscriptionEvent] Received PAYMENT_FAILED event');
      this.logEvent(eventData);

      const { invoiceId, customerId, reason } = eventData.data;

      console.log(`[SubscriptionEvent] Payment failed for invoice ${invoiceId}: ${reason}`);

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
      console.error('[SubscriptionEvent] Error handling PAYMENT_FAILED:', error);
    }
  }

  @EventPattern(event.EventTopics.INVOICE_CREATED)
  async handleInvoiceCreated(@Payload() eventData: event.InvoiceCreatedEvent) {
    try {
      console.log('[SubscriptionEvent] Received INVOICE_CREATED event');
      this.logEvent(eventData);

      const { invoiceId, invoiceNumber, customerId } = eventData.data;

      console.log(`[SubscriptionEvent] Invoice ${invoiceNumber} created for customer ${customerId}`);

      // TODO: Send notification to customer about new invoice
      
    } catch (error) {
      console.error('[SubscriptionEvent] Error handling INVOICE_CREATED:', error);
    }
  }

  /** -------- Scheduled Jobs / Cron Events -------- */
  
  /**
   * This would be called by a scheduler service to check for expiring trials
   */
  async checkExpiringTrials() {
    try {
      console.log('[SubscriptionEvent] Checking for expiring trials...');
      
      // Find subscriptions on trial that are expiring soon (e.g., 3 days before end)
      // Send notifications to customers
      
    } catch (error) {
      console.error('[SubscriptionEvent] Error checking expiring trials:', error);
    }
  }

  /**
   * This would be called by a scheduler service to check for subscription renewals
   */
  async checkSubscriptionRenewals() {
    try {
      console.log('[SubscriptionEvent] Checking for subscriptions to renew...');
      
      const subscriptions = await this.subscriptionService.findSubscriptionsToRenew();
      
      console.log(`[SubscriptionEvent] Found ${subscriptions.length} subscriptions to renew`);
      
      for (const subscription of subscriptions) {
        console.log(`[SubscriptionEvent] Renewing subscription ${subscription.id}`);
        await this.subscriptionService.renew(subscription.id);
      }
      
    } catch (error) {
      console.error('[SubscriptionEvent] Error checking subscription renewals:', error);
    }
  }

  /** -------- Helper Methods -------- */
  
  private logEvent<T extends { eventType: string; timestamp: Date | string }>(eventData: T) {
    const timestamp = typeof eventData.timestamp === 'string'
      ? new Date(eventData.timestamp).toISOString()
      : eventData.timestamp.toISOString();

    console.log(
      `[SubscriptionEvent] Received event [${eventData.eventType}] at ${timestamp}`,
    );
  }
}
