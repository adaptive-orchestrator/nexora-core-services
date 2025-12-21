import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemInputDto {
  @ApiPropertyOptional({ description: 'Product ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiProperty({ description: 'Item description', example: 'Product A' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Unit price', example: 100000 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ description: 'Total price', example: 200000 })
  @IsNumber()
  totalPrice: number;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Order ID (for retail orders)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Order Number', example: 'ORD-2025-001' })
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ApiProperty({ description: 'Customer ID', example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Invoice items', type: [InvoiceItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items: InvoiceItemInputDto[];

  @ApiProperty({ description: 'Subtotal amount', example: 500000 })
  @IsNumber()
  subtotal: number;

  @ApiPropertyOptional({ description: 'Tax amount', example: 50000 })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiPropertyOptional({ description: 'Shipping cost', example: 30000 })
  @IsNumber()
  @IsOptional()
  shippingCost?: number;

  @ApiPropertyOptional({ description: 'Discount amount', example: 0 })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty({ description: 'Total amount', example: 580000 })
  @IsNumber()
  totalAmount: number;

  @ApiPropertyOptional({ description: 'Due date', example: '2025-12-31' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes', example: 'Invoice for Order #1' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Billing period', enum: ['monthly', 'yearly', 'onetime'] })
  @IsString()
  @IsOptional()
  billingPeriod?: 'monthly' | 'yearly' | 'onetime';

  @ApiPropertyOptional({ description: 'Business model', example: 'retail' })
  @IsString()
  @IsOptional()
  businessModel?: string;
}
