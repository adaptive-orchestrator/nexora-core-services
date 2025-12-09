import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Customer ID (optional, defaults to authenticated user)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    description: 'Plan ID',
    example: 'p0000001-0000-0000-0000-000000000001',
  })
  @IsString()
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
