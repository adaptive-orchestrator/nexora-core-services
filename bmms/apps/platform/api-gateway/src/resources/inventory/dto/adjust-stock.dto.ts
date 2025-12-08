import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, IsEnum, IsOptional } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({
    description: 'Quantity to adjust (positive for increase, negative for decrease)',
    example: 50,
    type: Number,
  })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({
    description: 'Reason for adjustment',
    example: 'restock',
    enum: ['restock', 'damage', 'loss', 'adjustment', 'correction'],
  })
  @IsOptional()
  @IsEnum(['restock', 'damage', 'loss', 'adjustment', 'correction'])
  reason?: string;

  @ApiPropertyOptional({
    description: 'Type of adjustment',
    example: 'RESTOCK',
    type: String,
  })
  @IsOptional()
  @IsString()
  adjustmentType?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the adjustment',
    example: 'Nhập từ nhà cung cấp ABC',
    type: String,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
