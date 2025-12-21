import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Invoice ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ description: 'Order ID', example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012', required: false })
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiProperty({ description: 'Customer ID', example: 'c3d4e5f6-a7b8-9012-cdef-345678901234', required: false })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Payment amount', example: 500000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Payment method', example: 'vnpay' })
  @IsString()
  method: string;
}
