import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'iPhone 15 Pro Max' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Product description', example: '256GB, Titanium Blue - Latest Apple flagship smartphone' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Product price', example: 1299.99 })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Product category', example: 'Electronics', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Product SKU', example: 'IPHONE-15-PRO-256GB-BLUE', required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ description: 'Is product active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
