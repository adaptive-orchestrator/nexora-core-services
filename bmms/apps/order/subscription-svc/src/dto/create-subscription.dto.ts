import { IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
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
