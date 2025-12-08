import { IsNumber, IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionPaymentDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Subscription ID' })
  @IsUUID()
  subscriptionId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Customer ID' })
  @IsUUID()
  customerId: string;

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

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  paymentId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  invoiceId: string;

  @ApiProperty({ example: '2025-11-29T12:00:00.000Z' })
  paidAt: Date;
}
