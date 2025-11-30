import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum PaymentStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Payment ID', example: 1 })
  @IsNumber()
  paymentId: number;

  @ApiProperty({ 
    description: 'Payment status', 
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS 
  })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiProperty({ description: 'Transaction ID from payment gateway', example: 'VNPAY-TXN-123', required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiProperty({ description: 'Payment amount', example: 100000, required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({ description: 'Failure reason if payment failed', required: false })
  @IsString()
  @IsOptional()
  failureReason?: string;
}
