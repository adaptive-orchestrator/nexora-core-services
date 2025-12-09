import { IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  planId: string;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsOptional()
  @IsBoolean()
  useTrial?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}
