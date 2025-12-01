import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionPaymentDto {
  @ApiProperty({ example: 1, description: 'Subscription ID' })
  @IsNumber()
  subscriptionId: number;

  @ApiProperty({ example: 1, description: 'Customer ID' })
  @IsNumber()
  customerId: number;

  @ApiProperty({ example: 49.99, description: 'Payment amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'Professional Plan', description: 'Plan name', required: false })
  @IsString()
  @IsOptional()
  planName?: string;

  @ApiProperty({ example: 'CREDIT_CARD', description: 'Payment method', required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ example: 'VND', description: 'Currency', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'Subscription payment', description: 'Notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubscriptionPaymentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment successful' })
  message: string;

  @ApiProperty({ example: 'TXN-1234567890-abcd1234' })
  transactionId: string;

  @ApiProperty({ example: 1 })
  paymentId: number;

  @ApiProperty({ example: 1 })
  invoiceId: number;

  @ApiProperty({ example: '2025-11-29T12:00:00.000Z' })
  paidAt: Date;
}
