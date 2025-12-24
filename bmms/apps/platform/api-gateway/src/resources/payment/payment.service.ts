import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedPaymentsResponse {
  payments: any[];
  pagination: PaginationMeta;
}

interface IPaymentGrpcService {
  initiatePayment(data: any): any;
  confirmPayment(data: any): any;
  getPaymentById(data: any): any;
  getAllPayments(data: any): any;
  getPaymentsByInvoice(data: any): any;
  getPaymentStats(data: any): any;
  processPayment(data: any): any;
  // Stripe operations
  createCheckoutSession(data: any): any;
  createSubscriptionCheckout(data: any): any;
  createSubscriptionPaymentCheckout(data: any): any;
  createPaymentIntent(data: any): any;
  createRefund(data: any): any;
  handleStripeWebhook(data: any): any;
  getOrCreateCustomer(data: any): any;
  createBillingPortalSession(data: any): any;
  cancelStripeSubscription(data: any): any;
}

@Injectable()
export class PaymentService implements OnModuleInit {
  private paymentService: IPaymentGrpcService;

  constructor(
    @Inject('PAYMENT_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.paymentService = this.client.getService<IPaymentGrpcService>('PaymentService');
  }

  async initiatePayment(dto: InitiatePaymentDto) {
    const response: any = await firstValueFrom(this.paymentService.initiatePayment(dto));
    return response.payment;
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    const response: any = await firstValueFrom(this.paymentService.confirmPayment(dto));
    return response.payment;
  }

  async getPaymentById(id: string) {
    const response: any = await firstValueFrom(this.paymentService.getPaymentById({ id }));
    return response.payment;
  }

  async getAllPayments(page: number = 1, limit: number = 20): Promise<PaginatedPaymentsResponse> {
    const response: any = await firstValueFrom(
      this.paymentService.getAllPayments({ page, limit })
    );
    return {
      payments: response.payments || [],
      pagination: response.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  async getPaymentsByInvoice(invoiceId: string) {
    const response: any = await firstValueFrom(
      this.paymentService.getPaymentsByInvoice({ invoiceId })
    );
    return response.payments;
  }

  async getPaymentsByCustomer(customerId: string, page: number = 1, limit: number = 20): Promise<PaginatedPaymentsResponse> {
    // Filter payments by customer ID
    // Note: This may need to be implemented in the payment-svc gRPC service
    // For now, we'll get all payments and filter by customerId
    const response: any = await firstValueFrom(
      this.paymentService.getAllPayments({ page: 1, limit: 1000 }) // Get more to filter
    );
    
    const allPayments = response.payments || [];
    const filteredPayments = allPayments.filter(
      (payment: any) => payment.customerId === customerId
    );
    
    // Apply pagination to filtered results
    const startIndex = (page - 1) * limit;
    const paginatedPayments = filteredPayments.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(filteredPayments.length / limit);
    
    return {
      payments: paginatedPayments,
      pagination: {
        page,
        limit,
        total: filteredPayments.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getPaymentStats() {
    return firstValueFrom(this.paymentService.getPaymentStats({}));
  }

  async processPayment(dto: { invoiceId: string; amount: number; paymentMethod: string }) {
    const response: any = await firstValueFrom(this.paymentService.processPayment(dto));
    return response;
  }

  // =================== STRIPE OPERATIONS ===================

  /**
   * Create Stripe checkout session for one-time payment
   */
  async createCheckoutSession(dto: {
    customerId: string;
    orderId: string;
    items: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      description?: string;
      imageUrl?: string;
    }>;
    successUrl: string;
    cancelUrl: string;
    currency?: string;
    metadata?: Record<string, string>;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.createCheckoutSession(dto)
    );
    return response;
  }

  /**
   * Create Stripe checkout session for subscription
   */
  async createSubscriptionCheckout(dto: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.createSubscriptionCheckout(dto)
    );
    return response;
  }

  /**
   * Create Stripe checkout session for subscription payment (one-time)
   */
  async createSubscriptionPaymentCheckout(dto: {
    customerId: string;
    email: string;
    amount: number;
    currency?: string;
    subscriptionId?: string;
    planName?: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.createSubscriptionPaymentCheckout(dto)
    );
    return response;
  }

  /**
   * Create PaymentIntent for custom payment flows
   */
  async createPaymentIntent(dto: {
    amount: number;
    currency: string;
    customerId?: string;
    orderId?: string;
    metadata?: Record<string, string>;
    paymentMethodType?: string;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.createPaymentIntent(dto)
    );
    return response;
  }

  /**
   * Create refund for a payment
   */
  async createRefund(dto: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.createRefund(dto)
    );
    return response;
  }

  /**
   * Handle Stripe webhook - forward raw body to payment-svc
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const response: any = await firstValueFrom(
      this.paymentService.handleStripeWebhook({
        rawBody,
        signature,
      })
    );
    return response;
  }

  /**
   * Get or create Stripe customer
   */
  async getOrCreateCustomer(dto: {
    userId: string;
    email: string;
    name?: string;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.getOrCreateCustomer(dto)
    );
    return response;
  }

  /**
   * Create billing portal session for customer self-service
   */
  async createBillingPortalSession(dto: {
    stripeCustomerId: string;
    returnUrl: string;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.createBillingPortalSession(dto)
    );
    return response;
  }

  /**
   * Cancel Stripe subscription
   */
  async cancelStripeSubscription(dto: {
    stripeSubscriptionId: string;
    cancelAtPeriodEnd?: boolean;
  }) {
    const response: any = await firstValueFrom(
      this.paymentService.cancelStripeSubscription(dto)
    );
    return response;
  }
}
