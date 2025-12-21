import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { StripeWebhookService } from './stripe-webhook.service';

// Interface for raw body request
interface RawBodyRequest {
  rawBody?: Buffer;
}

/**
 * Stripe Webhook Controller
 * 
 * IMPORTANT: This controller handles Stripe webhooks via HTTP (REST).
 * It must be exposed as a public HTTP endpoint, NOT gRPC.
 * 
 * In production, this endpoint should be:
 * - Exposed via API Gateway or directly on public internet
 * - Protected only by Stripe signature verification (no auth required)
 * - URL: https://your-domain.com/api/v1/stripe/webhook
 * 
 * Configure Stripe Dashboard webhook endpoint to point to this URL.
 */
@ApiTags('Stripe Webhook')
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  /**
   * Stripe Webhook Endpoint
   * 
   * This endpoint receives webhook events from Stripe.
   * It uses raw body for signature verification.
   * 
   * IMPORTANT NOTES:
   * 1. This endpoint must receive RAW body (Buffer), not parsed JSON
   * 2. Configure NestJS to preserve raw body for this route
   * 3. Always return 200 to acknowledge receipt (prevents Stripe retry)
   * 4. Signature verification is done inside the service
   * 
   * In main.ts, add:
   * ```
   * app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
   * ```
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Stripe Webhook Handler',
    description: 'Receives and processes Stripe webhook events. This endpoint is called by Stripe servers.'
  })
  @ApiResponse({ status: 200, description: 'Webhook received and processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or payload' })
  async handleWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: any,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    this.logger.log('[Webhook] Received Stripe webhook request');

    // Check for signature header
    if (!signature) {
      this.logger.warn('[Webhook] Missing stripe-signature header');
      // Always return 200 to prevent Stripe from retrying
      res.status(200).json({
        received: true,
        error: 'Missing stripe-signature header',
      });
      return;
    }

    // Get raw body - IMPORTANT: Must be Buffer for signature verification
    const rawBody = req.rawBody;

    if (!rawBody) {
      this.logger.error('[Webhook] Raw body not available. Ensure express.raw() middleware is configured.');
      res.status(200).json({
        received: true,
        error: 'Raw body not available. Check server configuration.',
      });
      return;
    }

    try {
      // Process webhook event
      await this.stripeWebhookService.handleWebhookEvent(rawBody, signature);

      this.logger.log('[Webhook] Webhook processed successfully');
      res.status(200).json({ received: true });
    } catch (error) {
      // Always return 200 to prevent Stripe from retrying on errors we've logged
      // Only signature verification errors should potentially return 400
      this.logger.error('[Webhook] Error processing webhook:', error);
      
      res.status(200).json({
        received: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check for webhook endpoint
   */
  @Post('webhook/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Health Check' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is healthy' })
  async webhookHealth(): Promise<{ status: string; timestamp: Date }> {
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }
}
