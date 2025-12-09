import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsUUID } from 'class-validator';

export enum PaymentStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Payment ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  paymentId: string;

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
