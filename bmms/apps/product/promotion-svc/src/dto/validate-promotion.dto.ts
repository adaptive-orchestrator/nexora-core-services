import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class ValidatePromotionDto {
  @IsString()
  code: string;

  @IsUUID()
  customerId: string;

  @IsUUID()
  planId: string;

  @IsOptional()
  @IsNumber()
  purchaseAmount?: number;
}

export class ApplyPromotionDto extends ValidatePromotionDto {
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;
}

export class PromotionValidationResult {
  valid: boolean;
  promotion?: any;
  error?: string;
  calculatedDiscount?: {
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    trialExtensionDays?: number;
    freeMonths?: number;
  };
}
