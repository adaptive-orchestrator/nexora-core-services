import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Line item for checkout session
 */
export class CheckoutLineItemDto {
  @ApiProperty({ example: 'prod-123', description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 'Premium Widget', description: 'Product name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1999, description: 'Price in smallest currency unit (cents)' })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNumber()
  quantity: number;
}

/**
 * DTO for creating a Stripe checkout session
 */
export class CreateStripeCheckoutSessionDto {
  @ApiProperty({ 
    type: [CheckoutLineItemDto],
    description: 'Line items for checkout' 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineItemDto)
  lineItems: CheckoutLineItemDto[];

  @ApiProperty({ example: 'order-uuid-123', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'customer-uuid-123', description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ 
    example: 'http://localhost:3000/checkout/success', 
    description: 'Success redirect URL' 
  })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({ 
    example: 'http://localhost:3000/checkout/cancel', 
    description: 'Cancel redirect URL' 
  })
  @IsString()
  @IsOptional()
  cancelUrl?: string;

  @ApiPropertyOptional({ example: 'usd', description: 'Currency (default: usd)' })
  @IsString()
  @IsOptional()
  currency?: string;
}

/**
 * Response DTO for checkout session
 */
export class StripeCheckoutSessionResponseDto {
  @ApiProperty({ example: 'cs_test_xxx', description: 'Stripe session ID' })
  sessionId: string;

  @ApiProperty({ example: 'https://checkout.stripe.com/xxx', description: 'Checkout URL' })
  url: string;
}

/**
 * DTO for creating a subscription checkout session
 */
export class CreateStripeSubscriptionCheckoutDto {
  @ApiProperty({ example: 'customer-uuid-123', description: 'Customer ID in our system' })
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ example: 'cus_xxx', description: 'Stripe Customer ID (if already created)' })
  @IsString()
  @IsOptional()
  stripeCustomerId?: string;

  @ApiProperty({ example: 'customer@example.com', description: 'Customer email (for creating Stripe customer)' })
  @IsString()
  email: string;

  @ApiProperty({ example: 'price_xxx', description: 'Stripe Price ID for the subscription' })
  @IsString()
  priceId: string;

  @ApiPropertyOptional({ example: 'sub-123', description: 'Internal subscription ID' })
  @IsString()
  @IsOptional()
  subscriptionId?: string;

  @ApiPropertyOptional({ example: 'Pro Plan', description: 'Plan name for metadata' })
  @IsString()
  @IsOptional()
  planName?: string;

  @ApiPropertyOptional({ 
    example: 'http://localhost:3000/subscription/success', 
    description: 'Success redirect URL' 
  })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({ 
    example: 'http://localhost:3000/subscription/cancel', 
    description: 'Cancel redirect URL' 
  })
  @IsString()
  @IsOptional()
  cancelUrl?: string;
}

/**
 * DTO for creating a payment intent
 */
export class CreateStripePaymentIntentDto {
  @ApiProperty({ example: 1999, description: 'Amount in smallest currency unit (cents)' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'usd', description: 'Currency (default: usd)' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'order-123', description: 'Order ID for metadata' })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ example: 'customer-123', description: 'Customer ID for metadata' })
  @IsString()
  @IsOptional()
  customerId?: string;
}

/**
 * Response DTO for payment intent
 */
export class StripePaymentIntentResponseDto {
  @ApiProperty({ example: 'pi_xxx', description: 'Payment Intent ID' })
  paymentIntentId: string;

  @ApiProperty({ example: 'pi_xxx_secret_xxx', description: 'Client secret for frontend' })
  clientSecret: string;

  @ApiProperty({ example: 'requires_payment_method', description: 'Payment Intent status' })
  status: string;
}

/**
 * DTO for refund request
 */
export class CreateStripeRefundDto {
  @ApiProperty({ example: 'pi_xxx', description: 'Payment Intent ID to refund' })
  @IsString()
  paymentIntentId: string;

  @ApiProperty({ example: 'order-123', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ example: 1000, description: 'Partial refund amount (optional, refunds full amount if not provided)' })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ example: 'Customer requested cancellation', description: 'Refund reason' })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Response DTO for refund
 */
export class StripeRefundResponseDto {
  @ApiProperty({ example: 're_xxx', description: 'Refund ID' })
  refundId: string;

  @ApiProperty({ example: 1999, description: 'Refunded amount' })
  amount: number;

  @ApiProperty({ example: 'succeeded', description: 'Refund status' })
  status: string;
}

/**
 * DTO for billing portal session
 */
export class CreateStripeBillingPortalDto {
  @ApiProperty({ example: 'cus_xxx', description: 'Stripe Customer ID' })
  @IsString()
  stripeCustomerId: string;

  @ApiPropertyOptional({ 
    example: 'http://localhost:3000/account', 
    description: 'Return URL after portal session' 
  })
  @IsString()
  @IsOptional()
  returnUrl?: string;
}
