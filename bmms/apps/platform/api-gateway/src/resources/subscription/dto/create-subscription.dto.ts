import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Plan ID',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  })
  @IsUUID()
  planId: string;

  @ApiProperty({
    description: 'Promotion code (optional)',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiProperty({
    description: 'Use trial period if available',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useTrial?: boolean;
}
