
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from './payment-svc.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { SubscriptionPaymentDto, SubscriptionPaymentResponseDto } from './dto/subscription-payment.dto';
import { 
  CreateStripeCheckoutSessionDto, 
  CreateStripeSubscriptionCheckoutDto,
  CreateStripePaymentIntentDto,
  CreateStripeRefundDto,
  CreateStripeBillingPortalDto,
  StripeCheckoutSessionResponseDto,
  StripePaymentIntentResponseDto,
  StripeRefundResponseDto,
} from './dto/stripe-checkout.dto';
import { Payment } from './entities/payment.entity';
import { StripeService } from './stripe/stripe.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
  ) {}

  // =================== LIST ALL PAYMENTS ===================
  // IMPORTANT: Route phải được order sao cho specific routes trước generic routes
  // Nếu `@Get()` đứng trước `@Get(':id')` sẽ không parse được :id
  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả các thanh toán với pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (mặc định: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số item mỗi trang (mặc định: 20, tối đa: 100)' })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.paymentService.list(page, limit);
  }

  // =================== PAYMENT STATISTICS ===================
  // IMPORTANT: Generic routes như /stats/summary PHẢI đứng trước @Get(':id')
  @Get('stats/summary')
  @ApiOperation({ summary: 'Thống kê thanh toán tổng hợp' })
  async getStats(): Promise<any> {
    return this.paymentService.getPaymentStats();
  }

  // =================== GET PAYMENT BY INVOICE ===================
  // IMPORTANT: /invoice/:invoiceId phải đứng trước generic @Get(':id')
  @Get('invoice/:invoiceId')
  @ApiOperation({ summary: 'Lấy danh sách thanh toán theo hóa đơn' })
  async getByInvoice(
    @Param('invoiceId') invoiceId: string,
  ): Promise<Payment[]> {
    return this.paymentService.getByInvoice(invoiceId);
  }

  // =================== SUBSCRIPTION PAYMENT ===================
  // API thanh toán subscription - gọi trực tiếp từ frontend
  // Sau này sẽ thay bằng VNPay/Momo integration
  @Post('subscription/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Thanh toán subscription',
    description: 'API thanh toán subscription trực tiếp. Tạo invoice, xử lý thanh toán và emit event để activate subscription.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Thanh toán thành công', 
    type: SubscriptionPaymentResponseDto 
  })
  async paySubscription(
    @Body() dto: SubscriptionPaymentDto,
  ): Promise<SubscriptionPaymentResponseDto> {
    return this.paymentService.processSubscriptionPayment(dto);
  }

  // =================== GET PAYMENT BY ID ===================
  // IMPORTANT: Generic route phải đứng ở cuối cùng
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin thanh toán theo ID' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin thanh toán', type: Payment })
  async getById(@Param('id') id: string): Promise<Payment> {
    return this.paymentService.getById(id);
  }

  // =================== INITIATE PAYMENT ===================
  @Post('initiate')
  @ApiOperation({ summary: 'Khởi tạo thanh toán mới' })
  @ApiResponse({ status: 201, description: 'Tạo thanh toán thành công', type: Payment })
  async initiatePayment(@Body() dto: CreatePaymentDto): Promise<Payment> {
    return this.paymentService.initiatePayment(dto);
  }

  // =================== CONFIRM PAYMENT ===================
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận kết quả thanh toán' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thanh toán', type: Payment })
  async confirmPayment(@Body() dto: ConfirmPaymentDto): Promise<Payment> {
    return this.paymentService.confirmPayment(dto);
  }

  // =================== TEST EVENT EMITTERS ===================

  @Post(':paymentId/test/success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.success event for testing flow' })
  async testEmitSuccess(
    @Param('paymentId') paymentId: string,
    @Body() data: {
      invoiceId: string;
      orderId?: string;
      customerId?: string;
      amount: number;
      transactionId?: string;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentSuccess({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      amount: data.amount,
      method: 'vnpay',
      transactionId: data.transactionId || `TEST-TXN-${Date.now()}`,
      paidAt: new Date(),
    });
    
    return { message: `payment.success event emitted for payment ${paymentId}` };
  }

  @Post(':paymentId/test/failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.failed event for testing flow' })
  async testEmitFailed(
    @Param('paymentId') paymentId: string,
    @Body() data: {
      invoiceId: string;
      orderId?: string;
      customerId?: string;
      amount: number;
      reason: string;
      errorCode?: string;
      canRetry?: boolean;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentFailed({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      amount: data.amount,
      method: 'vnpay',
      reason: data.reason,
      errorCode: data.errorCode,
      canRetry: data.canRetry,
    });
    
    return { message: `payment.failed event emitted for payment ${paymentId}` };
  }

  @Post(':paymentId/test/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.retry event for testing flow' })
  async testEmitRetry(
    @Param('paymentId') paymentId: string,
    @Body() data: {
      invoiceId: string;
      orderId?: string;
      customerId?: string;
      amount: number;
      retryCount: number;
      previousFailureReason: string;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentRetry({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      amount: data.amount,
      retryCount: data.retryCount,
      previousFailureReason: data.previousFailureReason,
    });
    
    return { message: `payment.retry event emitted for payment ${paymentId}` };
  }

  @Post(':paymentId/test/refunded')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.refunded event for testing flow' })
  async testEmitRefunded(
    @Param('paymentId') paymentId: string,
    @Body() data: {
      invoiceId: string;
      orderId?: string;
      customerId?: string;
      refundAmount: number;
      reason: string;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentRefunded({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      refundAmount: data.refundAmount,
      reason: data.reason,
      refundedAt: new Date(),
    });
    
    return { message: `payment.refunded event emitted for payment ${paymentId}` };
  }

  // =================== STRIPE CHECKOUT ENDPOINTS ===================

  @Post('stripe/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe Checkout Session',
    description: 'Creates a Stripe checkout session for one-time payment. Returns a URL to redirect customer to Stripe Checkout.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Checkout session created', 
    type: StripeCheckoutSessionResponseDto 
  })
  async createStripeCheckout(
    @Body() dto: CreateStripeCheckoutSessionDto,
  ): Promise<StripeCheckoutSessionResponseDto> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    const result = await this.stripeService.createCheckoutSession(
      dto.lineItems,
      dto.orderId,
      dto.customerId,
      dto.successUrl || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      dto.cancelUrl || `${baseUrl}/checkout/cancel`,
      dto.currency || 'usd',
    );

    return result;
  }

  @Post('stripe/checkout/subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe Subscription Checkout Session',
    description: 'Creates a Stripe checkout session for subscription payment.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription checkout session created', 
    type: StripeCheckoutSessionResponseDto 
  })
  async createStripeSubscriptionCheckout(
    @Body() dto: CreateStripeSubscriptionCheckoutDto,
  ): Promise<StripeCheckoutSessionResponseDto> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Create Stripe customer if not exists
    let stripeCustomerId = dto.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripeService.createCustomer(dto.email, {
        customer_id: dto.customerId,
      });
      stripeCustomerId = customer.id;
    }

    const result = await this.stripeService.createSubscriptionCheckoutSession(
      stripeCustomerId,
      dto.priceId,
      dto.customerId,
      dto.successUrl || `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      dto.cancelUrl || `${baseUrl}/subscription/cancel`,
      {
        subscription_id: dto.subscriptionId || '',
        plan_name: dto.planName || '',
      },
    );

    return result;
  }

  @Post('stripe/checkout/subscription-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe Checkout for Subscription Payment (One-time)',
    description: 'Creates a Stripe checkout session for subscription payment using one-time payment mode (when no Stripe Price ID exists).'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription payment checkout session created', 
    type: StripeCheckoutSessionResponseDto 
  })
  async createStripeSubscriptionPaymentCheckout(
    @Body() dto: {
      customerId: string;
      email: string;
      amount: number;
      currency?: string;
      subscriptionId?: string;
      planName?: string;
      successUrl?: string;
      cancelUrl?: string;
    },
  ): Promise<StripeCheckoutSessionResponseDto> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Create Stripe customer if not exists
    const customer = await this.stripeService.createCustomer(dto.email, {
      customer_id: dto.customerId,
    });

    // Create checkout session with payment mode (one-time payment)
    const session = await this.stripeService.createOneTimeCheckoutSession({
      customerId: customer.id,
      amount: dto.amount,
      currency: dto.currency || 'usd',
      productName: dto.planName || 'Subscription Payment',
      successUrl: dto.successUrl || `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: dto.cancelUrl || `${baseUrl}/subscription/cancel`,
      metadata: {
        customer_id: dto.customerId,
        subscription_id: dto.subscriptionId || '',
        plan_name: dto.planName || '',
        payment_type: 'subscription_payment',
      },
    });

    return {
      sessionId: session.id,
      url: session.url || '',
    };
  }
  @Post('stripe/payment-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe Payment Intent',
    description: 'Creates a Payment Intent for custom payment flows (e.g., Stripe Elements).'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment intent created', 
    type: StripePaymentIntentResponseDto 
  })
  async createStripePaymentIntent(
    @Body() dto: CreateStripePaymentIntentDto,
  ): Promise<StripePaymentIntentResponseDto> {
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: dto.amount,
      currency: dto.currency || 'usd',
      orderId: dto.orderId,
      customerId: dto.customerId,
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || '',
      status: paymentIntent.status,
    };
  }

  @Post('stripe/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe Refund',
    description: 'Refunds a payment via Stripe.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Refund created', 
    type: StripeRefundResponseDto 
  })
  async createStripeRefund(
    @Body() dto: CreateStripeRefundDto,
  ): Promise<StripeRefundResponseDto> {
    const refund = await this.stripeService.createRefund({
      paymentIntentId: dto.paymentIntentId,
      orderId: dto.orderId,
      amount: dto.amount,
    });

    return {
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status || 'unknown',
    };
  }

  @Post('stripe/billing-portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe Billing Portal Session',
    description: 'Creates a Stripe Billing Portal session for customer self-service.'
  })
  @ApiResponse({ status: 200, description: 'Billing portal URL returned' })
  async createStripeBillingPortal(
    @Body() dto: CreateStripeBillingPortalDto,
  ): Promise<{ url: string }> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    return await this.stripeService.createBillingPortalSession(
      dto.stripeCustomerId,
      dto.returnUrl || `${baseUrl}/account`,
    );
  }

  @Get('stripe/session/:sessionId')
  @ApiOperation({ summary: 'Get Stripe Checkout Session details' })
  @ApiResponse({ status: 200, description: 'Checkout session details' })
  async getStripeSession(@Param('sessionId') sessionId: string) {
    const session = await this.stripeService.retrieveCheckoutSession(sessionId);
    return {
      id: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      amountTotal: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_email,
      metadata: session.metadata,
    };
  }

  // =================== gRPC METHODS FOR API GATEWAY ===================
  
  @GrpcMethod('PaymentService', 'InitiatePayment')
  async grpcInitiatePayment(data: CreatePaymentDto) {
    const payment = await this.paymentService.initiatePayment(data);
    return { payment };
  }

  @GrpcMethod('PaymentService', 'ConfirmPayment')
  async grpcConfirmPayment(data: ConfirmPaymentDto) {
    const payment = await this.paymentService.confirmPayment(data);
    return { payment };
  }

  @GrpcMethod('PaymentService', 'GetPaymentById')
  async grpcGetPaymentById(data: { id: string }) {
    const payment = await this.paymentService.getById(data.id);
    return { payment };
  }

  @GrpcMethod('PaymentService', 'GetAllPayments')
  async grpcGetAllPayments(data: { page?: number; limit?: number }) {
    const page = data?.page || 1;
    const limit = data?.limit || 20;
    const result = await this.paymentService.list(page, limit);
    return { 
      payments: result.payments,
      pagination: result.pagination,
    };
  }

  @GrpcMethod('PaymentService', 'GetPaymentsByInvoice')
  async grpcGetPaymentsByInvoice(data: { invoiceId: string }) {
    const payments = await this.paymentService.getByInvoice(data.invoiceId);
    return { payments };
  }

  @GrpcMethod('PaymentService', 'GetPaymentStats')
  async grpcGetPaymentStats() {
    const stats = await this.paymentService.getPaymentStats();
    return stats;
  }

  // =================== STRIPE gRPC METHODS ===================

  @GrpcMethod('PaymentService', 'CreateCheckoutSession')
  async grpcCreateCheckoutSession(data: any) {
    try {
      const items = (data.items || []).map((item: any) => ({
        productId: item.productId,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        description: item.description,
        imageUrl: item.imageUrl,
      }));

      const session = await this.stripeService.createCheckoutSession({
        customerId: data.customerId,
        orderId: data.orderId,
        items,
        successUrl: data.successUrl,
        cancelUrl: data.cancelUrl,
        currency: data.currency || 'usd',
        metadata: data.metadata || {},
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create checkout session',
      };
    }
  }

  @GrpcMethod('PaymentService', 'CreateSubscriptionCheckout')
  async grpcCreateSubscriptionCheckout(data: any) {
    try {
      // First, get or create Stripe customer
      const customer = await this.stripeService.createCustomer({
        email: data.email || `${data.customerId}@placeholder.com`,
        name: data.name,
        metadata: { userId: data.customerId },
      });

      const session = await this.stripeService.createSubscriptionCheckoutSession(
        customer.id,
        data.priceId,
        data.customerId,
        data.successUrl,
        data.cancelUrl,
        data.trialDays,
      );

      return {
        sessionId: session.sessionId,
        checkoutUrl: session.url,
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create subscription checkout',
      };
    }
  }

  @GrpcMethod('PaymentService', 'CreatePaymentIntent')
  async grpcCreatePaymentIntent(data: any) {
    try {
      const paymentIntent = await this.stripeService.createPaymentIntent(
        Number(data.amount),
        data.currency || 'usd',
        data.orderId,
        data.customerId,
        data.metadata || {},
      );

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create payment intent',
      };
    }
  }

  @GrpcMethod('PaymentService', 'CreateRefund')
  async grpcCreateRefund(data: any) {
    try {
      const refund = await this.stripeService.createRefund(
        data.paymentIntentId,
        data.amount ? Number(data.amount) : undefined,
        data.reason,
      );

      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create refund',
      };
    }
  }

  @GrpcMethod('PaymentService', 'HandleStripeWebhook')
  async grpcHandleStripeWebhook(data: { rawBody: Buffer; signature: string }) {
    try {
      // This would be called from API Gateway forwarding the webhook
      // Note: In practice, webhooks are handled via HTTP not gRPC
      // This is for internal gRPC communication if needed
      return {
        received: true,
        message: 'Webhook received via gRPC',
      };
    } catch (error) {
      return {
        received: false,
        message: error instanceof Error ? error.message : 'Failed to process webhook',
      };
    }
  }

  @GrpcMethod('PaymentService', 'GetOrCreateCustomer')
  async grpcGetOrCreateCustomer(data: { userId: string; email: string; name?: string }) {
    try {
      // First check if customer exists in our records
      // For now, just create a new Stripe customer
      const customer = await this.stripeService.createCustomer({
        email: data.email,
        name: data.name,
        metadata: { userId: data.userId },
      });

      return {
        stripeCustomerId: customer.id,
        isNew: true, // Would need to track existing customers
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get/create customer',
      };
    }
  }

  @GrpcMethod('PaymentService', 'CreateBillingPortalSession')
  async grpcCreateBillingPortalSession(data: { stripeCustomerId: string; returnUrl: string }) {
    try {
      const result = await this.stripeService.createBillingPortalSession(
        data.stripeCustomerId,
        data.returnUrl,
      );

      return {
        portalUrl: result.url,
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create billing portal session',
      };
    }
  }

  @GrpcMethod('PaymentService', 'CancelStripeSubscription')
  async grpcCancelStripeSubscription(data: { stripeSubscriptionId: string; cancelAtPeriodEnd?: boolean }) {
    try {
      const subscription = await this.stripeService.cancelSubscription(
        data.stripeSubscriptionId,
        data.cancelAtPeriodEnd ?? true,
      );

      return {
        success: true,
        status: subscription.status,
        canceledAt: subscription.canceled_at 
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel subscription',
      };
    }
  }
}
