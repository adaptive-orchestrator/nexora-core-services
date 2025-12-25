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
        // First check if subscription exists and its current status
        const subscription = await this.subscriptionService.findById(subscriptionId);

        if (subscription.status === 'active') {
          console.log(`[SubscriptionEvent] Subscription ${subscriptionId} is already active. Payment received will be logged but no status change needed.`);
          // Optionally extend the subscription period or log as a renewal
          return;
        }

        // Only activate if status is PENDING
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

  /** -------- Stripe Webhook Events (from payment-svc) -------- */

  /**
   * Handle subscription.payment.completed event (from Stripe one-time payment checkout)
   * This is emitted when a customer pays for subscription via Stripe checkout (payment mode)
   */
  @EventPattern('subscription.payment.completed')
  async handleSubscriptionPaymentCompleted(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received subscription.payment.completed event (Stripe)');
      this.logEvent(eventData);

      const { subscriptionId, customerId, paymentId, amount, planName, stripeSessionId } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe subscription payment completed:`);
      console.log(`   Subscription ID: ${subscriptionId}`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Plan: ${planName || 'N/A'}`);
      console.log(`   Stripe Session: ${stripeSessionId}`);

      // Activate subscription
      if (subscriptionId) {
        try {
          // First check if subscription exists and its current status
          const subscription = await this.subscriptionService.findById(subscriptionId);

          if (subscription.status === 'active') {
            console.log(`[SubscriptionEvent] Subscription ${subscriptionId} is already active. Payment received will be logged but no status change needed.`);
            return;
          }

          await this.subscriptionService.activateSubscription(subscriptionId);
          console.log(`[SubscriptionEvent] Subscription ${subscriptionId} activated successfully via Stripe payment`);
        } catch (activateError) {
          console.error(`[SubscriptionEvent] Failed to activate subscription ${subscriptionId}:`, activateError.message);
        }
      } else {
        console.warn('[SubscriptionEvent] No subscriptionId in event, cannot activate');
      }

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling subscription.payment.completed:', error);
    }
  }

  /**
   * Handle Stripe checkout.session.completed event
   * This is emitted when a customer completes a Stripe checkout
   */
  @EventPattern('stripe.checkout.completed')
  async handleStripeCheckoutCompleted(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received stripe.checkout.completed event');
      this.logEvent(eventData);

      const { customerId, stripeSessionId, amount } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe checkout completed:`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Session ID: ${stripeSessionId}`);
      console.log(`   Amount: ${amount}`);

      // If this was a subscription checkout, activate the pending subscription
      // The subscription-svc should have a pending subscription waiting for payment
      if (customerId) {
        await this.activatePendingSubscription(customerId);
      }

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling stripe.checkout.completed:', error);
    }
  }

  /**
   * Handle Stripe subscription.created event
   * This is emitted when a subscription is created in Stripe
   */
  @EventPattern('stripe.subscription.created')
  async handleStripeSubscriptionCreated(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received stripe.subscription.created event');
      this.logEvent(eventData);

      const { customerId, stripeSubscriptionId, stripeCustomerId, status, currentPeriodEnd } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe subscription created:`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Stripe Sub ID: ${stripeSubscriptionId}`);
      console.log(`   Status: ${status}`);

      // Update local subscription with Stripe subscription ID
      if (customerId && stripeSubscriptionId) {
        try {
          await this.subscriptionService.linkStripeSubscription(customerId, stripeSubscriptionId);
          console.log(`[SubscriptionEvent] Linked Stripe subscription ${stripeSubscriptionId} to customer ${customerId}`);
        } catch (linkError) {
          console.warn(`[SubscriptionEvent] Could not link Stripe subscription:`, linkError.message);
        }
      }

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling stripe.subscription.created:', error);
    }
  }

  /**
   * Handle Stripe subscription.updated event
   * This is emitted when a subscription status changes in Stripe
   */
  @EventPattern('stripe.subscription.updated')
  async handleStripeSubscriptionUpdated(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received stripe.subscription.updated event');
      this.logEvent(eventData);

      const { stripeSubscriptionId, status, currentPeriodEnd, cancelAtPeriodEnd } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe subscription updated:`);
      console.log(`   Stripe Sub ID: ${stripeSubscriptionId}`);
      console.log(`   Status: ${status}`);
      console.log(`   Cancel at period end: ${cancelAtPeriodEnd}`);

      // Update local subscription based on Stripe status
      await this.handleStripeStatusChange(stripeSubscriptionId, status, currentPeriodEnd, cancelAtPeriodEnd);

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling stripe.subscription.updated:', error);
    }
  }

  /**
   * Handle Stripe subscription.deleted event
   * This is emitted when a subscription is cancelled/deleted in Stripe
   */
  @EventPattern('stripe.subscription.deleted')
  async handleStripeSubscriptionDeleted(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received stripe.subscription.deleted event');
      this.logEvent(eventData);

      const { stripeSubscriptionId, canceledAt } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe subscription deleted:`);
      console.log(`   Stripe Sub ID: ${stripeSubscriptionId}`);
      console.log(`   Canceled at: ${canceledAt}`);

      // Cancel local subscription
      await this.cancelSubscriptionByStripeId(stripeSubscriptionId);

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling stripe.subscription.deleted:', error);
    }
  }

  /**
   * Handle Stripe invoice.paid event
   * This is emitted when a recurring subscription invoice is paid
   */
  @EventPattern('stripe.invoice.paid')
  async handleStripeInvoicePaid(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received stripe.invoice.paid event');
      this.logEvent(eventData);

      const { stripeSubscriptionId, amountPaid, paidAt } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe invoice paid:`);
      console.log(`   Stripe Sub ID: ${stripeSubscriptionId}`);
      console.log(`   Amount: ${amountPaid}`);

      // Extend subscription period if this is a renewal payment
      if (stripeSubscriptionId) {
        await this.extendSubscriptionPeriod(stripeSubscriptionId);
      }

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling stripe.invoice.paid:', error);
    }
  }

  /**
   * Handle Stripe invoice.failed event
   * This is emitted when a recurring subscription payment fails
   */
  @EventPattern('stripe.invoice.failed')
  async handleStripeInvoiceFailed(@Payload() eventData: any) {
    try {
      console.log('[SubscriptionEvent] Received stripe.invoice.failed event');
      this.logEvent(eventData);

      const { stripeSubscriptionId, attemptCount, nextPaymentAttempt } = eventData.data;

      console.log(`[SubscriptionEvent] Stripe invoice payment failed:`);
      console.log(`   Stripe Sub ID: ${stripeSubscriptionId}`);
      console.log(`   Attempt: ${attemptCount}`);
      console.log(`   Next attempt: ${nextPaymentAttempt}`);

      // Mark subscription as past_due if payment fails
      if (stripeSubscriptionId) {
        await this.handleStripeStatusChange(stripeSubscriptionId, 'past_due', null, false);
      }

    } catch (error) {
      console.error('[SubscriptionEvent] Error handling stripe.invoice.failed:', error);
    }
  }

  /** -------- Stripe Event Helper Methods -------- */

  private async activatePendingSubscription(customerId: string): Promise<void> {
    try {
      // Find pending subscription for this customer
      const pendingSub = await this.subscriptionService.findPendingByCustomer(customerId);
      if (pendingSub) {
        await this.subscriptionService.activateSubscription(pendingSub.id);
        console.log(`[SubscriptionEvent] Activated pending subscription ${pendingSub.id}`);
      }
    } catch (error) {
      console.warn('[SubscriptionEvent] Could not activate pending subscription:', error.message);
    }
  }

  private async handleStripeStatusChange(
    stripeSubscriptionId: string,
    stripeStatus: string,
    currentPeriodEnd: Date | string | null,
    cancelAtPeriodEnd: boolean,
  ): Promise<void> {
    try {
      // Map Stripe status to local status
      let localStatus: SubscriptionStatus;
      switch (stripeStatus) {
        case 'active':
          localStatus = SubscriptionStatus.ACTIVE;
          break;
        case 'past_due':
          localStatus = SubscriptionStatus.PAST_DUE;
          break;
        case 'canceled':
        case 'cancelled':
          localStatus = SubscriptionStatus.CANCELLED;
          break;
        case 'unpaid':
          localStatus = SubscriptionStatus.EXPIRED;
          break;
        case 'trialing':
          localStatus = SubscriptionStatus.TRIAL;
          break;
        default:
          localStatus = SubscriptionStatus.ACTIVE;
      }

      await this.subscriptionService.updateByStripeId(stripeSubscriptionId, {
        status: localStatus,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
        cancelAtPeriodEnd,
      });

      console.log(`[SubscriptionEvent] Updated subscription status to ${localStatus} for Stripe ID ${stripeSubscriptionId}`);
    } catch (error) {
      console.warn(`[SubscriptionEvent] Could not update subscription status:`, error.message);
    }
  }

  private async cancelSubscriptionByStripeId(stripeSubscriptionId: string): Promise<void> {
    try {
      await this.subscriptionService.cancelByStripeId(stripeSubscriptionId, 'Cancelled via Stripe');
      console.log(`[SubscriptionEvent] Cancelled subscription with Stripe ID ${stripeSubscriptionId}`);
    } catch (error) {
      console.warn(`[SubscriptionEvent] Could not cancel subscription:`, error.message);
    }
  }

  private async extendSubscriptionPeriod(stripeSubscriptionId: string): Promise<void> {
    try {
      await this.subscriptionService.extendPeriodByStripeId(stripeSubscriptionId);
      console.log(`[SubscriptionEvent] Extended subscription period for Stripe ID ${stripeSubscriptionId}`);
    } catch (error) {
      console.warn(`[SubscriptionEvent] Could not extend subscription period:`, error.message);
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
