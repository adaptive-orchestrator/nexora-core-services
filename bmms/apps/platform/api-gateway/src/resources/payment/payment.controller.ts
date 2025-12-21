import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query,
  Req,
  Res,
  Headers,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PaymentService, PaginatedPaymentsResponse } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PaymentResponseDto, PaymentStatsDto } from './dto/payment-response.dto';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtUserPayload } from '../../decorators/current-user.decorator';

// Interface for raw body request
interface RawBodyRequest {
  rawBody?: Buffer;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  
  constructor(private readonly paymentService: PaymentService) {}

  // ============ User-specific endpoints ============

  @Get('my')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get current user payments' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'User payments retrieved successfully' })
  async getMyPayments(
    @CurrentUser() user: JwtUserPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedPaymentsResponse> {
    // Get payments filtered by user's customerId
    return this.paymentService.getPaymentsByCustomer(user.userId, page, limit);
  }

  @Get('my/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get specific payment for current user' })
  @ApiResponse({ status: 200, description: 'Payment found', type: PaymentResponseDto })
  @ApiResponse({ status: 403, description: 'Payment does not belong to user' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getMyPaymentById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const payment: any = await this.paymentService.getPaymentById(id);
    
    // Verify payment belongs to user (through invoice -> customer relationship)
    // For now, we'll check if the payment's associated data matches the user
    if (user.role !== 'admin' && payment?.payment?.customerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }
    
    return payment;
  }

  // ============ Admin endpoints ============

  @Get()
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get all payments with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getAllPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedPaymentsResponse> {
    return this.paymentService.getAllPayments(page, limit);
  }

  @Get('stats/summary')
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get payment statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment stats retrieved', type: PaymentStatsDto })
  async getPaymentStats() {
    return this.paymentService.getPaymentStats();
  }

  @Get('invoice/:invoiceId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get payments by invoice ID' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPaymentsByInvoice(
    @CurrentUser() user: JwtUserPayload,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    // TODO: Verify invoice belongs to user before returning payments
    return this.paymentService.getPaymentsByInvoice(invoiceId);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment found', type: PaymentResponseDto })
  @ApiResponse({ status: 403, description: 'Payment does not belong to user' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const payment: any = await this.paymentService.getPaymentById(id);
    
    // Admin can access all, regular users can only access their own
    if (user.role !== 'admin' && payment?.payment?.customerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }
    
    return payment;
  }

  @Post('initiate')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Initiate new payment' })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully', type: PaymentResponseDto })
  async initiatePayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: InitiatePaymentDto,
  ) {
    // TODO: Verify invoice belongs to user before initiating payment
    return this.paymentService.initiatePayment(dto);
  }

  @Post('confirm')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm payment result' })
  @ApiResponse({ status: 200, description: 'Payment confirmed', type: PaymentResponseDto })
  async confirmPayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: ConfirmPaymentDto,
  ) {
    // TODO: Verify payment transaction belongs to user before confirming
    return this.paymentService.confirmPayment(dto);
  }

  @Post('pay')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process payment immediately (for testing/simple flow)' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully', type: PaymentResponseDto })
  async processPayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: { invoiceId: number; amount: number; paymentMethod: string },
  ) {
    // TODO: Verify invoice belongs to user before processing payment
    return this.paymentService.processPayment(dto);
  }

  // =================== STRIPE ENDPOINTS ===================

  @Post('stripe/checkout')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe checkout session',
    description: 'Creates a Stripe checkout session for one-time payment. Returns checkout URL to redirect user.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'items', 'successUrl', 'cancelUrl'],
      properties: {
        orderId: { type: 'string', example: 'order-123' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', example: 'prod-1' },
              name: { type: 'string', example: 'Premium Widget' },
              price: { type: 'number', example: 2999, description: 'Price in cents' },
              quantity: { type: 'number', example: 2 },
            }
          }
        },
        successUrl: { type: 'string', example: 'https://yourapp.com/checkout/success?session_id={CHECKOUT_SESSION_ID}' },
        cancelUrl: { type: 'string', example: 'https://yourapp.com/checkout/cancel' },
        currency: { type: 'string', example: 'usd', default: 'usd' },
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Checkout session created',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', example: 'cs_test_xxx' },
        checkoutUrl: { type: 'string', example: 'https://checkout.stripe.com/c/pay/cs_test_xxx' },
        success: { type: 'boolean', example: true },
      }
    }
  })
  async createCheckoutSession(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: {
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
    },
  ) {
    return this.paymentService.createCheckoutSession({
      customerId: user.userId,
      orderId: dto.orderId,
      items: dto.items,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      currency: dto.currency || 'usd',
      metadata: { userId: user.userId },
    });
  }

  @Post('stripe/subscription-checkout')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe subscription checkout',
    description: 'Creates a Stripe checkout session for subscription purchase.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['priceId', 'successUrl', 'cancelUrl'],
      properties: {
        priceId: { type: 'string', example: 'price_xxx', description: 'Stripe Price ID' },
        successUrl: { type: 'string', example: 'https://yourapp.com/subscription/success' },
        cancelUrl: { type: 'string', example: 'https://yourapp.com/subscription/cancel' },
        trialDays: { type: 'number', example: 14, description: 'Optional trial period days' },
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription checkout session created',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        checkoutUrl: { type: 'string' },
        success: { type: 'boolean' },
      }
    }
  })
  async createSubscriptionCheckout(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: {
      priceId: string;
      successUrl: string;
      cancelUrl: string;
      trialDays?: number;
    },
  ) {
    return this.paymentService.createSubscriptionCheckout({
      customerId: user.userId,
      priceId: dto.priceId,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      trialDays: dto.trialDays,
      metadata: { userId: user.userId },
    });
  }

  @Post('stripe/payment-intent')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create Stripe PaymentIntent',
    description: 'Creates a PaymentIntent for custom payment flows with Stripe Elements.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'PaymentIntent created',
    schema: {
      type: 'object',
      properties: {
        paymentIntentId: { type: 'string' },
        clientSecret: { type: 'string' },
        status: { type: 'string' },
        success: { type: 'boolean' },
      }
    }
  })
  async createPaymentIntent(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: {
      amount: number;
      currency: string;
      orderId?: string;
      paymentMethodType?: string;
    },
  ) {
    return this.paymentService.createPaymentIntent({
      amount: dto.amount,
      currency: dto.currency,
      customerId: user.userId,
      orderId: dto.orderId,
      paymentMethodType: dto.paymentMethodType,
      metadata: { userId: user.userId },
    });
  }

  @Post('stripe/refund')
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create refund (Admin only)',
    description: 'Creates a refund for a Stripe payment.'
  })
  @ApiResponse({ status: 200, description: 'Refund created successfully' })
  async createRefund(
    @Body() dto: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
    },
  ) {
    return this.paymentService.createRefund(dto);
  }

  @Post('stripe/billing-portal')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Create billing portal session',
    description: 'Creates a Stripe Customer Portal session for self-service subscription management.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Portal session created',
    schema: {
      type: 'object',
      properties: {
        portalUrl: { type: 'string' },
        success: { type: 'boolean' },
      }
    }
  })
  async createBillingPortalSession(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: {
      returnUrl: string;
      stripeCustomerId?: string;
    },
  ) {
    // If user doesn't provide stripeCustomerId, get it from user record
    const customerId = dto.stripeCustomerId || user.userId;
    return this.paymentService.createBillingPortalSession({
      stripeCustomerId: customerId,
      returnUrl: dto.returnUrl,
    });
  }

  // =================== WEBHOOK ENDPOINT ===================
  /**
   * Stripe Webhook Handler
   * 
   * IMPORTANT: This endpoint receives webhooks from Stripe.
   * Configure in main.ts: app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Stripe webhook handler',
    description: 'Receives and processes Stripe webhook events. No authentication required - uses Stripe signature verification.'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: any,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    this.logger.log('[Webhook] Received Stripe webhook at API Gateway');

    if (!signature) {
      this.logger.warn('[Webhook] Missing stripe-signature header');
      res.status(200).json({ received: true, error: 'Missing signature' });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.warn('[Webhook] No raw body found - ensure raw body parser is configured');
      res.status(200).json({ received: true, error: 'No raw body' });
      return;
    }

    try {
      // Forward to payment-svc via gRPC
      const result = await this.paymentService.handleStripeWebhook(rawBody, signature);
      res.status(200).json(result);
    } catch (error) {
      this.logger.error('[Webhook] Error processing webhook:', error);
      // Always return 200 to prevent Stripe retries for errors we handled
      res.status(200).json({ received: true, error: error instanceof Error ? error.message : 'Processing error' });
    }
  }
}
