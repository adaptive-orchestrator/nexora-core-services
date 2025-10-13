
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Payment ID' })
  @IsString()
  paymentId: string;

  @ApiProperty({ example: 'success', description: 'Payment status', enum: ['success', 'failed'] })
  @IsEnum(['success', 'failed'])
  status: 'success' | 'failed';

  @ApiProperty({ example: 'TXN-1702000000000-abc12345', description: 'Transaction ID' })
  @IsString()
  transactionId: string;

  @ApiProperty({ example: 100000, description: 'Payment amount', required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({ example: 'credit_card', description: 'Payment method', required: false })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiProperty({ example: 'Payment failed - Invalid card', description: 'Failure reason', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}