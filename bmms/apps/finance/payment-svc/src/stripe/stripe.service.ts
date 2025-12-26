import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from './stripe.module';

/**
 * StripeService - Pure Stripe API Integration Layer
 * 
 * Trách nhiệm:
 * - Tạo Checkout Session, Payment Intent, Subscription
 * - Verify Webhook Signature (CHỈ VERIFY, KHÔNG XỬ LÝ BUSINESS LOGIC)
 * - Quản lý Customer, Refund trên Stripe
 * 
 * NGUYÊN TẮC QUAN TRỌNG:
 * - Service này KHÔNG BAO GIỜ inject PaymentService hay bất kỳ service nào khác
 * - Chỉ return kết quả từ Stripe API cho caller
 * - Business logic (update DB, emit event) thuộc về caller (Controller/Service)
 * - Tránh hoàn toàn circular dependency
 */

// Custom Exceptions
export class CheckoutSessionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutSessionException';
  }
}

export class StripeRefundException extends Error {
  constructor(orderId: string, originalError?: Error) {
    super(`Failed to refund payment for order ${orderId}: ${originalError?.message || 'Unknown error'}`);
    this.name = 'StripeRefundException';
  }
}

export class WebhookSignatureException extends Error {
  constructor() {
    super('Webhook signature verification failed');
    this.name = 'WebhookSignatureException';
  }
}

export class BillingPortalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingPortalException';
  }
}

export class SubscriptionCancellationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionCancellationException';
  }
}

// Interfaces
export interface OrderLineItem {
  productId: string;
  name: string;
  price: number; // Price in smallest currency unit (cents for USD, đồng for VND)
  quantity: number;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
  id: string; // Alias for sessionId
}

// DTO Interfaces for method parameters
export interface CreateCheckoutSessionDto {
  customerId: string;
  orderId: string;
  items: OrderLineItem[];
  successUrl: string;
  cancelUrl: string;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerDto {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentDto {
  amount: number;
  currency: string;
  orderId?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface CreateRefundDto {
  paymentIntentId: string;
  orderId?: string;
  amount?: number;
  reason?: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @Inject(STRIPE_CLIENT)
    private readonly stripe: Stripe,
    private readonly configService: ConfigService,
  ) {}

  // =================== CHECKOUT SESSION (ONE-TIME PAYMENT) ===================
  /**
   * Creates a Stripe checkout session for the given order (one-time payment)
   * Accepts a DTO object for cleaner API
   */
  async createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResult>;
  async createCheckoutSession(
    lineItems: OrderLineItem[],
    orderId: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string,
    currency?: string,
  ): Promise<CheckoutSessionResult>;
  async createCheckoutSession(
    dtoOrLineItems: CreateCheckoutSessionDto | OrderLineItem[],
    orderId?: string,
    customerId?: string,
    successUrl?: string,
    cancelUrl?: string,
    currency: string = 'usd',
  ): Promise<CheckoutSessionResult> {
    // Normalize parameters - support both DTO and legacy multi-param calls
    let lineItems: OrderLineItem[];
    let actualOrderId: string;
    let actualCustomerId: string;
    let actualSuccessUrl: string;
    let actualCancelUrl: string;
    let actualCurrency: string;
    let metadata: Record<string, string> = {};

    if (Array.isArray(dtoOrLineItems)) {
      // Legacy call with multiple parameters
      lineItems = dtoOrLineItems;
      actualOrderId = orderId!;
      actualCustomerId = customerId!;
      actualSuccessUrl = successUrl!;
      actualCancelUrl = cancelUrl!;
      actualCurrency = currency;
    } else {
      // New DTO-based call
      const dto = dtoOrLineItems;
      lineItems = dto.items;
      actualOrderId = dto.orderId;
      actualCustomerId = dto.customerId;
      actualSuccessUrl = dto.successUrl;
      actualCancelUrl = dto.cancelUrl;
      actualCurrency = dto.currency || 'usd';
      metadata = dto.metadata || {};
    }

    try {
      this.logger.log(`[Stripe] Creating checkout session for order ${actualOrderId}`);

      const stripeLineItems = this.buildStripeLineItems(lineItems, actualCurrency);

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: stripeLineItems,
        mode: 'payment',
        success_url: actualSuccessUrl,
        cancel_url: actualCancelUrl,
        metadata: {
          order_id: actualOrderId,
          customer_id: actualCustomerId,
          ...metadata,
        },
      });

      if (!session.url) {
        throw new CheckoutSessionException('Stripe session URL is null');
      }

      this.logger.log(`[Stripe] Checkout session created: ${session.id}`);

      return {
        sessionId: session.id,
        id: session.id,
        url: session.url,
      };
    } catch (error) {
      this.logger.error(`[Stripe] Error creating checkout session:`, error);
      if (error instanceof CheckoutSessionException) {
        throw error;
      }
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to create checkout session',
      );
    }
  }

  // =================== SUBSCRIPTION CHECKOUT SESSION ===================
  /**
   * Creates a Stripe checkout session for a subscription
   */
  async createSubscriptionCheckoutSession(
    stripeCustomerId: string,
    priceId: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>,
  ): Promise<CheckoutSessionResult> {
    try {
      this.logger.log(`[Stripe] Creating subscription checkout session for customer ${customerId}`);

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          customer_id: customerId,
          ...metadata,
        },
      });

      if (!session.url) {
        throw new CheckoutSessionException('Stripe session URL is null');
      }

      this.logger.log(`[Stripe] Subscription checkout session created: ${session.id}`);

      return {
        sessionId: session.id,
        id: session.id,
        url: session.url,
      };
    } catch (error) {
      this.logger.error(`[Stripe] Error creating subscription checkout session:`, error);
      if (error instanceof CheckoutSessionException) {
        throw error;
      }
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to create subscription checkout session',
      );
    }
  }

  // =================== ONE-TIME CHECKOUT SESSION FOR SUBSCRIPTION PAYMENT ===================
  /**
   * Creates a Stripe checkout session for one-time subscription payment (no Stripe Price ID required)
   */
  async createOneTimeCheckoutSession(params: {
    customerId: string;
    amount: number;
    currency: string;
    productName: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string; url: string }> {
    try {
      this.logger.log(`[Stripe] Creating one-time checkout session for ${params.productName}, amount: ${params.amount}`);

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer: params.customerId,
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: {
                name: params.productName,
                description: `Subscription payment for ${params.productName}`,
              },
              unit_amount: params.amount, // Amount in cents
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {},
      });

      if (!session.url) {
        throw new CheckoutSessionException('Stripe session URL is null');
      }

      this.logger.log(`[Stripe] One-time checkout session created: ${session.id}`);

      return {
        id: session.id,
        url: session.url,
      };
    } catch (error) {
      this.logger.error(`[Stripe] Error creating one-time checkout session:`, error);
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to create checkout session',
      );
    }
  }

  // =================== RETRIEVE CHECKOUT SESSION ===================
  /**
   * Retrieves a checkout session from Stripe
   */
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      this.logger.log(`[Stripe] Retrieving checkout session: ${sessionId}`);
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      this.logger.error(`[Stripe] Error retrieving checkout session:`, error);
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to retrieve session',
      );
    }
  }

  // =================== PAYMENT INTENT ===================
  /**
   * Creates a Payment Intent for custom payment flows
   * Supports both DTO-based and legacy multi-param calls
   */
  async createPaymentIntent(
    amountOrDto: number | CreatePaymentIntentDto,
    currency?: string,
    orderId?: string,
    customerId?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    // Normalize parameters
    let amount: number;
    let actualCurrency: string;
    let actualMetadata: Record<string, string> = {};

    if (typeof amountOrDto === 'object') {
      // DTO-based call
      const dto = amountOrDto;
      amount = dto.amount;
      actualCurrency = dto.currency;
      actualMetadata = {
        ...dto.metadata,
        ...(dto.orderId ? { order_id: dto.orderId } : {}),
        ...(dto.customerId ? { customer_id: dto.customerId } : {}),
      };
    } else {
      // Legacy multi-param call
      amount = amountOrDto;
      actualCurrency = currency || 'usd';
      actualMetadata = {
        ...metadata,
        ...(orderId ? { order_id: orderId } : {}),
        ...(customerId ? { customer_id: customerId } : {}),
      };
    }

    try {
      this.logger.log(`[Stripe] Creating payment intent for amount ${amount} ${actualCurrency}`);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: actualCurrency,
        metadata: actualMetadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(`[Stripe] Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`[Stripe] Error creating payment intent:`, error);
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to create payment intent',
      );
    }
  }

  /**
   * Retrieves a Payment Intent
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`[Stripe] Error retrieving payment intent:`, error);
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to retrieve payment intent',
      );
    }
  }

  // =================== REFUND ===================
  /**
   * Creates a refund for a payment intent
   * Supports both DTO-based and legacy multi-param calls
   */
  async createRefund(
    paymentIntentIdOrDto: string | CreateRefundDto,
    amountOrOrderId?: number | string,
    reason?: string,
  ): Promise<Stripe.Refund> {
    // Normalize parameters
    let paymentIntentId: string;
    let orderId: string = 'unknown';
    let amount: number | undefined;

    if (typeof paymentIntentIdOrDto === 'object') {
      // DTO-based call
      const dto = paymentIntentIdOrDto;
      paymentIntentId = dto.paymentIntentId;
      orderId = dto.orderId || 'unknown';
      amount = dto.amount;
    } else {
      // Legacy multi-param call - check types
      paymentIntentId = paymentIntentIdOrDto;
      if (typeof amountOrOrderId === 'string') {
        // Legacy: createRefund(paymentIntentId, orderId, amount?)
        orderId = amountOrOrderId;
        amount = typeof reason === 'number' ? reason : undefined;
      } else {
        // New pattern: createRefund(paymentIntentId, amount?)
        amount = amountOrOrderId;
      }
    }

    try {
      this.logger.log(`[Stripe] Creating refund for order ${orderId}, payment intent ${paymentIntentId}`);

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      this.logger.log(`[Stripe] Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(`[Stripe] Error creating refund:`, error);
      throw new StripeRefundException(orderId, error instanceof Error ? error : undefined);
    }
  }

  // =================== WEBHOOK VERIFICATION ===================
  /**
   * Verifies a Stripe webhook signature and constructs the event
   */
  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('[Stripe] Webhook signature verification failed:', error);
      throw new WebhookSignatureException();
    }
  }

  // =================== CUSTOMER MANAGEMENT ===================
  /**
   * Creates a new Stripe customer
   * Supports both DTO-based and legacy multi-param calls
   */
  async createCustomer(emailOrDto: string | CreateCustomerDto, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    // Normalize parameters
    let email: string;
    let name: string | undefined;
    let actualMetadata: Record<string, string> | undefined;

    if (typeof emailOrDto === 'object') {
      // DTO-based call
      const dto = emailOrDto;
      email = dto.email;
      name = dto.name;
      actualMetadata = dto.metadata;
    } else {
      // Legacy multi-param call
      email = emailOrDto;
      actualMetadata = metadata;
    }

    try {
      this.logger.log(`[Stripe] Creating customer for email ${email}`);

      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: actualMetadata,
      });

      this.logger.log(`[Stripe] Customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error(`[Stripe] Error creating customer:`, error);
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to create customer',
      );
    }
  }

  /**
   * Retrieves a Stripe customer
   */
  async retrieveCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      this.logger.error(`[Stripe] Error retrieving customer:`, error);
      throw new CheckoutSessionException(
        error instanceof Error ? error.message : 'Failed to retrieve customer',
      );
    }
  }

  // =================== BILLING PORTAL ===================
  /**
   * Creates a Stripe Billing Portal session for customer self-service
   */
  async createBillingPortalSession(
    stripeCustomerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    try {
      this.logger.log(`[Stripe] Creating billing portal session for customer ${stripeCustomerId}`);

      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      this.logger.log(`[Stripe] Billing portal session created`);
      return { url: session.url };
    } catch (error) {
      this.logger.error(`[Stripe] Error creating billing portal session:`, error);
      throw new BillingPortalException(
        error instanceof Error ? error.message : 'Failed to create billing portal session',
      );
    }
  }

  // =================== SUBSCRIPTION MANAGEMENT ===================
  /**
   * Cancels a Stripe subscription
   * @param stripeSubscriptionId - The Stripe subscription ID
   * @param cancelAtPeriodEnd - Optional: If true, cancel at end of billing period (default: immediate cancellation)
   */
  async cancelSubscription(stripeSubscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<Stripe.Subscription> {
    try {
      this.logger.log(`[Stripe] Cancelling subscription ${stripeSubscriptionId}`);

      let canceledSubscription: Stripe.Subscription;
      
      if (cancelAtPeriodEnd) {
        // Cancel at end of current billing period
        canceledSubscription = await this.stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        // Immediate cancellation
        canceledSubscription = await this.stripe.subscriptions.cancel(stripeSubscriptionId);
      }

      this.logger.log(`[Stripe] Subscription cancelled: ${canceledSubscription.id}`);
      return canceledSubscription;
    } catch (error) {
      this.logger.error(`[Stripe] Error cancelling subscription:`, error);
      throw new SubscriptionCancellationException(
        error instanceof Error ? error.message : 'Failed to cancel subscription',
      );
    }
  }

  /**
   * Retrieves a Stripe subscription
   */
  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      this.logger.error(`[Stripe] Error retrieving subscription:`, error);
      throw new SubscriptionCancellationException(
        error instanceof Error ? error.message : 'Failed to retrieve subscription',
      );
    }
  }

  // =================== HELPER METHODS ===================
  /**
   * Builds Stripe line items from order line items
   */
  private buildStripeLineItems(
    lineItems: OrderLineItem[],
    currency: string = 'usd',
  ): Stripe.Checkout.SessionCreateParams.LineItem[] {
    return lineItems.map((item) => ({
      price_data: {
        currency,
        product_data: {
          name: item.name,
        },
        unit_amount: item.price, // Already in smallest currency unit
      },
      quantity: item.quantity,
    }));
  }

  /**
   * Get Stripe instance (for advanced usage)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}
