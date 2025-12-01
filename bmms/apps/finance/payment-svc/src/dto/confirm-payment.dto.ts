
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiProperty({ example: 1, description: 'Payment ID' })
  @IsNumber()
  paymentId: number;

  @ApiProperty({ example: 'success', description: 'Payment status', enum: ['success', 'failed'] })
  @IsEnum(['success', 'failed'])
  status: 'success' | 'failed';

  @ApiProperty({ example: 'TXN-1702000000000-abc12345', description: 'Transaction ID', required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;

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
  failureReason?: string;
}