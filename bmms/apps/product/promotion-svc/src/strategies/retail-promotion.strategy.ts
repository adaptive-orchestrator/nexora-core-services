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
 * Strategy 1: Retail Promotion (Product Discounts)
 * 
 * Characteristics:
 * - Percentage off (10% OFF, 20% OFF)
 * - Fixed amount discount (50k OFF)
 * - BOGO (Buy One Get One)
 * - Category-specific discounts
 */
@Injectable()
export class RetailPromotionStrategy implements IPromotionStrategy {
  private readonly logger = new Logger(RetailPromotionStrategy.name);

  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
  ) {}

  canHandle(businessModel: string): boolean {
    return businessModel === 'retail' || businessModel === 'onetime';
  }

  getStrategyName(): string {
    return 'RetailPromotionStrategy';
  }

  async validatePromotion(params: PromotionValidationParams): Promise<PromotionValidationResult> {
    this.logger.log(`🎫 Validating RETAIL promotion: ${params.promotionCode}`);

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

    // Check minimum order amount
    if (promotion.minPurchaseAmount && params.orderAmount) {
      if (params.orderAmount < promotion.minPurchaseAmount) {
        return {
          isValid: false,
          reason: `Minimum purchase amount is ${promotion.minPurchaseAmount}`,
        };
      }
    }

    // Calculate discount
    const discountAmount = await this.calculateDiscount({
      promotionType: promotion.type,
      promotionValue: promotion.discountValue || 0,
      orderAmount: params.orderAmount || 0,
    });

    return {
      isValid: true,
      discountAmount,
      discountType: promotion.type as any,
      metadata: {
        promotionId: promotion.id,
        promotionName: promotion.name,
      },
    };
  }

  async calculateDiscount(params: PromotionCalculationParams): Promise<number> {
    const { promotionType, promotionValue, orderAmount = 0 } = params;

    switch (promotionType) {
      case 'percentage':
        // Percentage discount (e.g., 10% OFF)
        return Math.floor((orderAmount * promotionValue) / 100);

      case 'fixed_amount':
        // Fixed amount discount (e.g., 50,000 VND OFF)
        return Math.min(promotionValue, orderAmount); // Can't exceed order amount

      case 'bogo':
        // Buy One Get One (50% off on total)
        return Math.floor(orderAmount * 0.5);

      default:
        return 0;
    }
  }
}
