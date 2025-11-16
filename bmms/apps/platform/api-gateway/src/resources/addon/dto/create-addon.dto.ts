import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsObject, Min } from 'class-validator';

export class CreateAddonDto {
  @ApiProperty({
    description: 'Unique identifier key for the add-on',
    example: 'extra_storage',
  })
  @IsString()
  addonKey: string;

  @ApiProperty({
    description: 'Display name of the add-on',
    example: 'Extra Storage 100GB',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Detailed description of the add-on',
    example: 'Additional 100GB storage space for your account',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Price of the add-on in VND',
    example: 50000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Billing period for the add-on',
    enum: ['monthly', 'yearly', 'onetime'],
    example: 'monthly',
  })
  @IsEnum(['monthly', 'yearly', 'onetime'])
  billingPeriod: 'monthly' | 'yearly' | 'onetime';

  @ApiProperty({
    description: 'Additional features or metadata for the add-on',
    example: { storage_gb: 100, priority_support: false },
    required: false,
  })
  @IsObject()
  @IsOptional()
  features?: Record<string, any>;
}
