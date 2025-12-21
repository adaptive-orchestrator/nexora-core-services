import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IPromotionStrategy,
  PromotionValidationParams,
  PromotionValidationResult,
  PromotionCalculationParams,
} from './promotion-strategy.interface';
import { Promotion } from '../entities/promotion.entity';

/**
 * Strategy 2: Subscription Promotion (Recurring Plans)
 * 
 * Characteristics:
 * - Free trial extension (7 days → 14 days)
 * - First-month discount (50% OFF first month)
 * - Annual discount (2 months FREE on yearly plan)
 * - Upgrade discounts
 */
@Injectable()
export class SubscriptionPromotionStrategy implements IPromotionStrategy {
  private readonly logger = new Logger(SubscriptionPromotionStrategy.name);

  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
  ) {}

  canHandle(businessModel: string): boolean {
    return businessModel === 'subscription' || businessModel === 'recurring';
  }

  getStrategyName(): string {
    return 'SubscriptionPromotionStrategy';
  }

  async validatePromotion(params: PromotionValidationParams): Promise<PromotionValidationResult> {
    this.logger.log(`[Promotion] Validating SUBSCRIPTION promotion: ${params.promotionCode}`);

    const promotion = await this.promotionRepo.findOne({
      where: { code: params.promotionCode.toUpperCase() },
    });

    if (!promotion) {
      return {
        isValid: false,
        reason: 'Promotion code not found',
      };
    }

    // Check if promotion is active
    if (promotion.status !== 'active') {
      return {
        isValid: false,
        reason: 'Promotion is not active',
      };
    }

    // Check validity dates
    const now = new Date();
    if (promotion.validFrom && promotion.validFrom > now) {
      return {
        isValid: false,
        reason: 'Promotion has not started yet',
      };
    }
    if (promotion.validUntil && promotion.validUntil < now) {
      return {
        isValid: false,
        reason: 'Promotion has expired',
      };
    }

    // Check if applicable to this plan
    if (params.subscriptionPlanId && !promotion.canApplyToPlan(params.subscriptionPlanId)) {
      return {
        isValid: false,
        reason: 'Promotion not applicable to this plan',
      };
    }

    // Determine discount type
    let discountType: 'percentage' | 'fixed' | 'free_trial' | 'bundle' = 'percentage';
    let discountAmount = 0;

    if (promotion.type === 'trial_extension') {
      discountType = 'free_trial';
      discountAmount = promotion.trialExtensionDays || 0;
    } else if (promotion.type === 'free_months') {
      discountType = 'fixed';
      discountAmount = promotion.freeMonths || 0;
    } else if (promotion.type === 'percentage' || promotion.type === 'fixed_amount') {
      discountType = promotion.type === 'percentage' ? 'percentage' : 'fixed';
      discountAmount = promotion.discountValue || 0;
    }

    return {
      isValid: true,
      discountAmount,
      discountType,
      metadata: {
        promotionId: promotion.id,
        promotionName: promotion.name,
        isRecurring: promotion.isRecurring,
        trialExtensionDays: promotion.trialExtensionDays,
        freeMonths: promotion.freeMonths,
      },
    };
  }

  async calculateDiscount(params: PromotionCalculationParams): Promise<number> {
    const { promotionType, promotionValue, orderAmount = 0 } = params;

    switch (promotionType) {
      case 'percentage':
        // First-month discount (e.g., 50% OFF)
        return Math.floor((orderAmount * promotionValue) / 100);

      case 'fixed_amount':
        // Fixed amount off (e.g., 30,000 VND OFF)
        return Math.min(promotionValue, orderAmount);

      case 'trial_extension':
        // Return number of extra trial days (not a monetary discount)
        return promotionValue;

      case 'free_months':
        // Return number of free months
        return promotionValue;

      default:
        return 0;
    }
  }
}
