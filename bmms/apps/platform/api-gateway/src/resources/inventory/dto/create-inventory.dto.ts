import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, IsUUID } from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty({
    description: 'Product ID from catalogue',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    type: String,
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Initial quantity',
    example: 100,
    type: Number,
    default: 0,
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Warehouse location',
    example: 'Warehouse A',
    type: String,
  })
  @IsOptional()
  @IsString()
  warehouseLocation?: string;

  @ApiPropertyOptional({
    description: 'Reorder level threshold',
    example: 20,
    type: Number,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  reorderLevel?: number;

  @ApiPropertyOptional({
    description: 'Maximum stock capacity',
    example: 500,
    type: Number,
    default: 1000,
  })
  @IsOptional()
  @IsInt()
  maxStock?: number;
}
