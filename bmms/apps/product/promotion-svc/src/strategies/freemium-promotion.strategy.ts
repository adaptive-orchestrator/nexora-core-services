import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IPromotionStrategy,
  PromotionValidationParams,
  PromotionValidationResult,
  PromotionCalculationParams,
} from './promotion-strategy.interface';
import { Promotion, PromotionType } from '../entities/promotion.entity';

/**
 * Strategy 3: Freemium Promotion (Free + Add-ons)
 * 
 * Characteristics:
 * - Add-on bundle discounts (Buy 2 add-ons, get 20% OFF)
 * - Upgrade promotion (First paid add-on 50% OFF)
 * - Seasonal add-on packs
 * - Cannot apply to base plan (always free)
 */
@Injectable()
export class FreemiumPromotionStrategy implements IPromotionStrategy {
  private readonly logger = new Logger(FreemiumPromotionStrategy.name);

  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
  ) {}

  canHandle(businessModel: string): boolean {
    return businessModel === 'freemium' || businessModel === 'addon';
  }

  getStrategyName(): string {
    return 'FreemiumPromotionStrategy';
  }

  async validatePromotion(params: PromotionValidationParams): Promise<PromotionValidationResult> {
    this.logger.log(`[Promotion] Validating FREEMIUM promotion: ${params.promotionCode}`);

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

    // Freemium-specific validations
    if (params.addonIds && params.addonIds.length > 0) {
      // Check if promotion applies to these add-ons
      const eligibleAddonIds = promotion.specificPlanIds || [];
      const hasEligibleAddon = params.addonIds.some((id) =>
        eligibleAddonIds.includes(String(id)),
      );

      if (eligibleAddonIds.length > 0 && !hasEligibleAddon) {
        return {
          isValid: false,
          reason: 'Promotion not applicable to selected add-ons',
        };
      }
    }

    // Check minimum add-on count for bundle promotions (optional, can be removed if not needed)
    // For now, we'll skip this validation since minItemsRequired doesn't exist in entity

    // Determine discount type
    let discountType: 'percentage' | 'fixed' | 'free_trial' | 'bundle' = 'percentage';
    let discountAmount = 0;

    if (promotion.type === PromotionType.PERCENTAGE) {
      discountType = 'percentage';
      discountAmount = promotion.discountValue || 0;
    } else if (promotion.type === PromotionType.FIXED_AMOUNT) {
      discountType = 'fixed';
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
        eligibleAddons: promotion.specificPlanIds,
      },
    };
  }

  async calculateDiscount(params: PromotionCalculationParams): Promise<number> {
    const { 
      promotionType, 
      promotionValue, 
      orderAmount = 0,
    } = params;

    switch (promotionType) {
      case 'percentage':
        // Percentage discount on total add-ons
        return Math.floor((orderAmount * promotionValue) / 100);

      case 'fixed_amount':
        // Fixed amount off total
        return Math.min(promotionValue, orderAmount);

      default:
        return 0;
    }
  }
}
