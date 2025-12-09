import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  Min,
  Max,
  Length,
} from 'class-validator';
import {
  PromotionType,
  PromotionStatus,
  ApplicableTo,
} from '../entities/promotion.entity';

export class CreatePromotionDto {
  @IsString()
  @Length(3, 50)
  code: string;

  @IsString()
  @Length(3, 255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionType)
  type: PromotionType;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;

  // Discount values
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100) // Nếu là percentage thì max 100%
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  trialExtensionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  freeMonths?: number;

  // Applicability
  @IsOptional()
  @IsEnum(ApplicableTo)
  applicableTo?: ApplicableTo;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificPlanIds?: string[];

  // Usage limits
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerCustomer?: number;

  // Validity period
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  // Conditions
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchaseAmount?: number;

  @IsOptional()
  @IsBoolean()
  isFirstTimeOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
