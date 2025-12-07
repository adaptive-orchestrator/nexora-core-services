
import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Invoice ID' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ example: 'INV-2025-10-00001', description: 'Invoice Number', required: false })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Customer ID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ example: 100000, description: 'Payment amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'credit_card', description: 'Payment method', required: false })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiProperty({ example: 'Payment for invoice', description: 'Payment description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
