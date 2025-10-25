import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  QUARTERLY = 'quarterly',
}

export class CreatePlanDto {
  @ApiProperty({ description: 'Plan name', example: 'Business Plan' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Plan description', example: 'Perfect for growing businesses' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Plan price', example: 199.99 })
  @IsNumber()
  price: number;

  @ApiProperty({ 
    description: 'Billing cycle', 
    enum: BillingCycle,
    example: BillingCycle.MONTHLY 
  })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'Trial period in days', example: 14, required: false })
  @IsNumber()
  @IsOptional()
  trialDays?: number;

  @ApiProperty({ description: 'Max users allowed', example: 10, required: false })
  @IsNumber()
  @IsOptional()
  maxUsers?: number;
}
