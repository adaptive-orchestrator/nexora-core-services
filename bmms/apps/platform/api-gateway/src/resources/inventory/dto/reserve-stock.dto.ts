import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsUUID } from 'class-validator';

export class ReserveStockDto {
  @ApiProperty({
    description: 'Product ID to reserve',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    type: String,
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity to reserve',
    example: 5,
    type: Number,
  })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Order ID',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    type: String,
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Customer ID',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    type: String,
  })
  @IsUUID()
  customerId: string;
}
