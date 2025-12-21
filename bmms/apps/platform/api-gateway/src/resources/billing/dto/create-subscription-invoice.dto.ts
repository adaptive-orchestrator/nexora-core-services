import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

/**
 * DTO for creating invoice for subscription payment
 * Used by frontend when user clicks "Đăng Ký Ngay" button
 */
export class CreateSubscriptionInvoiceDto {
  @ApiProperty({ description: 'Customer ID', example: 1 })
  @IsNumber()
  customerId: number;

  @ApiProperty({ description: 'Subscription ID', example: 1 })
  @IsNumber()
  subscriptionId: number;

  @ApiProperty({ description: 'Amount to charge', example: 49.99 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: 'Due date for payment', example: '2025-12-06' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes', example: 'First subscription payment' })
  @IsString()
  @IsOptional()
  notes?: string;
}
