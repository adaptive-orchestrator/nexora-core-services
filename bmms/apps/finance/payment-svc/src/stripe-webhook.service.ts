import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import Stripe from 'stripe';
import * as crypto from 'crypto';

import { StripeService } from './stripe/stripe.service';
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';
import { Payment, PaymentStatus, PaymentProvider } from './entities/payment.entity';
import { PaymentHistory } from './entities/payment-history.entity';
import { 
  StripeWebhookEvents, 
  WebhookProcessingStatus 
} from './constants/stripe-webhook-events';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    @InjectRepository(StripeWebhookEvent)
    private readonly webhookEventRepository: Repository<StripeWebhookEvent>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    @Inject('EVENT_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  // =================== MAIN WEBHOOK HANDLER ===================
  /**
   * Main entry point for handling Stripe webhooks
   */
  async handleWebhookEvent(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripeService.verifyWebhookSignature(payload, signature);
    } catch (error) {
      this.logger.error('[Webhook] Signature verification failed:', error);
      throw error;
    }

    this.logger.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // Check for duplicate processing (idempotency)
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { stripeEventId: event.id },
    });

    if (existingEvent && existingEvent.status === WebhookProcessingStatus.SUCCESS) {
      this.logger.log(`[Webhook] Event ${event.id} already processed successfully, skipping...`);
      return;
    }

    // Create or update webhook event record
    const webhookEvent = existingEvent || this.webhookEventRepository.create({
      stripeEventId: event.id,
      eventType: event.type,
      stripeObjectId: (event.data.object as any).id,
      status: WebhookProcessingStatus.PENDING,
      eventData: event.data.object as Record<string, any>,
    });

    await this.webhookEventRepository.save(webhookEvent);

    try {
      // Route to specific handler based on event type
      switch (event.type) {
        case StripeWebhookEvents.CHECKOUT_SESSION_COMPLETED:
          await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.CHECKOUT_SESSION_EXPIRED:
          await this.handleCheckoutSessionExpired(
            event.data.object as Stripe.Checkout.Session,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.PAYMENT_INTENT_SUCCEEDED:
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.PAYMENT_INTENT_PAYMENT_FAILED:
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.CHARGE_REFUNDED:
          await this.handleChargeRefunded(
            event.data.object as Stripe.Charge,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_CREATED:
          await this.handleSubscriptionCreated(
            event.data.object as Stripe.Subscription,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_UPDATED:
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_DELETED:
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.INVOICE_PAYMENT_SUCCEEDED:
          await this.handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
            webhookEvent,
          );
          break;

        case StripeWebhookEvents.INVOICE_PAYMENT_FAILED:
          await this.handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice,
            webhookEvent,
          );
          break;

        default:
          this.logger.log(`[Webhook] Unhandled event type: ${event.type}`);
          // Mark as success for unhandled events (we acknowledged receipt)
          webhookEvent.status = WebhookProcessingStatus.SUCCESS;
          webhookEvent.processedAt = new Date();
          await this.webhookEventRepository.save(webhookEvent);
      }
    } catch (error) {
      this.logger.error(`[Webhook] Error processing event ${event.type}:`, error);
      
      // Update webhook event status to failed
      webhookEvent.status = WebhookProcessingStatus.FAILED;
      webhookEvent.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webhookEvent.processedAt = new Date();
      await this.webhookEventRepository.save(webhookEvent);

      throw error;
    }
  }

  // =================== CHECKOUT SESSION HANDLERS ===================
  
  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing checkout.session.completed: ${session.id}`);

    const orderId = session.metadata?.order_id;
    const customerId = session.metadata?.customer_id;

    webhookEvent.orderId = orderId || undefined;
    webhookEvent.customerId = customerId || undefined;

    // Verify payment status
    if (session.payment_status !== 'paid') {
      this.logger.warn(`[Webhook] Session ${session.id} payment not completed: ${session.payment_status}`);
      webhookEvent.status = WebhookProcessingStatus.FAILED;
      webhookEvent.errorMessage = `Payment not completed: ${session.payment_status}`;
      webhookEvent.processedAt = new Date();
      await this.webhookEventRepository.save(webhookEvent);
      return;
    }

    // Create or update payment record
    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id;

    let payment = await this.paymentRepository.findOne({
      where: { stripeSessionId: session.id },
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        customerId: customerId || '',
        orderId: orderId || undefined,
        totalAmount: (session.amount_total || 0) / 100, // Convert from cents
        paidAmount: (session.amount_total || 0) / 100,
        currency: session.currency?.toUpperCase() || 'USD',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: typeof session.customer === 'string' 
          ? session.customer 
          : session.customer?.id,
        paidAt: new Date(),
        metadata: session.metadata as Record<string, any>,
      });
    } else {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAmount = (session.amount_total || 0) / 100;
      payment.stripePaymentIntentId = paymentIntentId;
      payment.paidAt = new Date();
    }

    const savedPayment = await this.paymentRepository.save(payment);
    webhookEvent.paymentId = savedPayment.id;

    // Log payment history
    await this.logPaymentHistory(
      savedPayment.id,
      savedPayment.invoiceId,
      'success',
      `Stripe checkout completed - Session: ${session.id}`,
    );

    // Emit Kafka event for other services
    this.kafkaClient.emit('stripe.checkout.completed', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.checkout.completed',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: savedPayment.id,
        orderId: orderId,
        customerId: customerId,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amount: savedPayment.paidAmount,
        currency: savedPayment.currency,
        paidAt: savedPayment.paidAt,
      },
    });

    // Check if this is a subscription payment → emit event to activate subscription
    const paymentType = session.metadata?.payment_type;
    const subscriptionId = session.metadata?.subscription_id;
    
    if (paymentType === 'subscription_payment' && subscriptionId) {
      this.logger.log(`[Webhook] Subscription payment detected, emitting activation event for subscription: ${subscriptionId}`);
      
      this.kafkaClient.emit('subscription.payment.completed', {
        eventId: crypto.randomUUID(),
        eventType: 'subscription.payment.completed',
        timestamp: new Date(),
        source: 'payment-svc',
        data: {
          subscriptionId: subscriptionId,
          customerId: customerId,
          paymentId: savedPayment.id,
          amount: savedPayment.paidAmount,
          currency: savedPayment.currency,
          planName: session.metadata?.plan_name,
          stripeSessionId: session.id,
          paidAt: savedPayment.paidAt,
        },
      });
    }

    // Update webhook event status
    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Checkout session completed successfully: ${session.id}`);
  }

  private async handleCheckoutSessionExpired(
    session: Stripe.Checkout.Session,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing checkout.session.expired: ${session.id}`);

    const orderId = session.metadata?.order_id;
    webhookEvent.orderId = orderId || undefined;

    // Find and update payment if exists
    const payment = await this.paymentRepository.findOne({
      where: { stripeSessionId: session.id },
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Checkout session expired';
      payment.failedAt = new Date();
      await this.paymentRepository.save(payment);

      await this.logPaymentHistory(
        payment.id,
        payment.invoiceId,
        'failed',
        'Stripe checkout session expired',
      );
    }

    // Emit Kafka event
    this.kafkaClient.emit('stripe.checkout.expired', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.checkout.expired',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        orderId: orderId,
        stripeSessionId: session.id,
        expiredAt: new Date(),
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Checkout session expired: ${session.id}`);
  }

  // =================== PAYMENT INTENT HANDLERS ===================

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing payment_intent.succeeded: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.order_id;
    const customerId = paymentIntent.metadata?.customer_id;

    webhookEvent.orderId = orderId || undefined;
    webhookEvent.customerId = customerId || undefined;

    // Find or create payment
    let payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        customerId: customerId || '',
        orderId: orderId || undefined,
        totalAmount: paymentIntent.amount / 100,
        paidAmount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id,
        paidAt: new Date(),
        metadata: paymentIntent.metadata as Record<string, any>,
      });
    } else {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAmount = paymentIntent.amount / 100;
      payment.paidAt = new Date();
    }

    const savedPayment = await this.paymentRepository.save(payment);
    webhookEvent.paymentId = savedPayment.id;

    await this.logPaymentHistory(
      savedPayment.id,
      savedPayment.invoiceId,
      'success',
      `Payment intent succeeded: ${paymentIntent.id}`,
    );

    // Emit Kafka event
    this.kafkaClient.emit('payment.success', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.success',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: savedPayment.id,
        orderId: orderId,
        customerId: customerId,
        stripePaymentIntentId: paymentIntent.id,
        amount: savedPayment.paidAmount,
        currency: savedPayment.currency,
        method: 'stripe',
        transactionId: paymentIntent.id,
        paidAt: savedPayment.paidAt,
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Payment intent succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing payment_intent.payment_failed: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.order_id;
    webhookEvent.orderId = orderId || undefined;

    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

    // Update payment if exists
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = failureMessage;
      payment.failedAt = new Date();
      await this.paymentRepository.save(payment);

      await this.logPaymentHistory(
        payment.id,
        payment.invoiceId,
        'failed',
        `Payment intent failed: ${failureMessage}`,
      );
    }

    // Emit Kafka event
    this.kafkaClient.emit('payment.failed', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.failed',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: payment?.id,
        orderId: orderId,
        stripePaymentIntentId: paymentIntent.id,
        reason: failureMessage,
        errorCode: paymentIntent.last_payment_error?.code,
        canRetry: true,
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Payment intent failed: ${paymentIntent.id}`);
  }

  // =================== REFUND HANDLER ===================

  private async handleChargeRefunded(
    charge: Stripe.Charge,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing charge.refunded: ${charge.id}`);

    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    // Find payment by payment intent
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (payment) {
      const refundedAmount = charge.amount_refunded / 100;
      const isFullRefund = charge.refunded;

      payment.refundedAmount = refundedAmount;
      payment.stripeRefundId = charge.refunds?.data?.[0]?.id;
      payment.refundedAt = new Date();
      payment.status = isFullRefund 
        ? PaymentStatus.REFUNDED 
        : PaymentStatus.PARTIALLY_REFUNDED;

      await this.paymentRepository.save(payment);
      webhookEvent.paymentId = payment.id;
      if (payment.orderId) {
        webhookEvent.orderId = payment.orderId;
      }

      await this.logPaymentHistory(
        payment.id,
        payment.invoiceId,
        'refunded',
        `Charge refunded: ${refundedAmount} ${payment.currency}`,
      );

      // Emit Kafka event
      this.kafkaClient.emit('payment.refunded', {
        eventId: crypto.randomUUID(),
        eventType: 'payment.refunded',
        timestamp: new Date(),
        source: 'payment-svc',
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          customerId: payment.customerId,
          stripeChargeId: charge.id,
          refundAmount: refundedAmount,
          isFullRefund: isFullRefund,
          refundedAt: new Date(),
        },
      });
    }

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Charge refunded: ${charge.id}`);
  }

  // =================== SUBSCRIPTION HANDLERS ===================

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing customer.subscription.created: ${subscription.id}`);

    const customerId = subscription.metadata?.customer_id;
    webhookEvent.customerId = customerId || undefined;

    // Emit Kafka event for subscription service
    this.kafkaClient.emit('stripe.subscription.created', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.subscription.created',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        customerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id,
        status: subscription.status,
        currentPeriodStart: subscription.items?.data?.[0]?.current_period_start 
          ? new Date(subscription.items.data[0].current_period_start * 1000) 
          : new Date(),
        currentPeriodEnd: subscription.items?.data?.[0]?.current_period_end 
          ? new Date(subscription.items.data[0].current_period_end * 1000) 
          : new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Subscription created: ${subscription.id}`);
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing customer.subscription.updated: ${subscription.id}`);

    // Emit Kafka event
    this.kafkaClient.emit('stripe.subscription.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.subscription.updated',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.items?.data?.[0]?.current_period_end 
          ? new Date(subscription.items.data[0].current_period_end * 1000) 
          : new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Subscription updated: ${subscription.id}`);
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing customer.subscription.deleted: ${subscription.id}`);

    // Emit Kafka event
    this.kafkaClient.emit('stripe.subscription.deleted', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.subscription.deleted',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id,
        canceledAt: subscription.canceled_at 
          ? new Date(subscription.canceled_at * 1000) 
          : new Date(),
        metadata: subscription.metadata,
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Subscription deleted: ${subscription.id}`);
  }

  // =================== INVOICE HANDLERS ===================

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing invoice.payment_succeeded: ${invoice.id}`);

    // Access subscription from parent or subscription_details
    const subscriptionData = (invoice as any).subscription;
    const subscriptionId = typeof subscriptionData === 'string'
      ? subscriptionData
      : subscriptionData?.id;

    // Emit Kafka event
    this.kafkaClient.emit('stripe.invoice.paid', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.invoice.paid',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id,
        amountPaid: (invoice.amount_paid || 0) / 100,
        currency: invoice.currency?.toUpperCase(),
        paidAt: invoice.status_transitions?.paid_at 
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Invoice payment succeeded: ${invoice.id}`);
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
    webhookEvent: StripeWebhookEvent,
  ): Promise<void> {
    this.logger.log(`[Webhook] Processing invoice.payment_failed: ${invoice.id}`);

    // Access subscription from parent or subscription_details
    const subscriptionData = (invoice as any).subscription;
    const subscriptionId = typeof subscriptionData === 'string'
      ? subscriptionData
      : subscriptionData?.id;

    // Emit Kafka event
    this.kafkaClient.emit('stripe.invoice.failed', {
      eventId: crypto.randomUUID(),
      eventType: 'stripe.invoice.failed',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id,
        amountDue: (invoice.amount_due || 0) / 100,
        currency: invoice.currency?.toUpperCase(),
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000)
          : null,
      },
    });

    webhookEvent.status = WebhookProcessingStatus.SUCCESS;
    webhookEvent.processedAt = new Date();
    await this.webhookEventRepository.save(webhookEvent);

    this.logger.log(`[Webhook] Invoice payment failed: ${invoice.id}`);
  }

  // =================== HELPER METHODS ===================

  private async logPaymentHistory(
    paymentId: string,
    invoiceId: string | undefined,
    action: 'initiated' | 'processing' | 'success' | 'failed' | 'refunded',
    details?: string,
  ): Promise<void> {
    try {
      const history = this.paymentHistoryRepository.create({
        paymentId,
        invoiceId: invoiceId || '',
        action,
        details,
        createdAt: new Date(),
      });

      await this.paymentHistoryRepository.save(history);
    } catch (error) {
      this.logger.error(`[Webhook] Error logging payment history:`, error);
    }
  }
}
