import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetailPromotionStrategy } from './retail-promotion.strategy';
import { SubscriptionPromotionStrategy } from './subscription-promotion.strategy';
import { FreemiumPromotionStrategy } from './freemium-promotion.strategy';
import {
  IPromotionStrategy,
  PromotionValidationParams,
  PromotionValidationResult,
  PromotionCalculationParams,
} from './promotion-strategy.interface';

/**
 * Factory Service for Promotion Strategies
 * 
 * Auto-selects the correct promotion strategy based on:
 * 1. PROMOTION_MODE environment variable (dev mode)
 * 2. businessModel parameter (runtime selection)
 * 
 * Usage:
 * ```typescript
 * // In dev mode, respect ENV:
 * const result = await strategyService.validatePromotionByEnv(params);
 * 
 * // In production, use explicit model:
 * const result = await strategyService.validatePromotionByModel('subscription', params);
 * ```
 */
@Injectable()
export class PromotionStrategyService {
  private readonly logger = new Logger(PromotionStrategyService.name);
  private readonly strategies: IPromotionStrategy[];

  constructor(
    private readonly configService: ConfigService,
    private readonly retailStrategy: RetailPromotionStrategy,
    private readonly subscriptionStrategy: SubscriptionPromotionStrategy,
    private readonly freemiumStrategy: FreemiumPromotionStrategy,
  ) {
    this.strategies = [
      this.retailStrategy,
      this.subscriptionStrategy,
      this.freemiumStrategy,
    ];

    const mode = this.configService.get<string>('PROMOTION_MODE', 'retail');
    this.logger.log(`🎯 PromotionStrategyService initialized with mode: ${mode}`);
    this.logger.log(`📦 Registered strategies: ${this.strategies.map((s) => s.getStrategyName()).join(', ')}`);
  }

  /**
   * Get strategy by explicit business model (Production use)
   */
  private getStrategyByModel(businessModel: string): IPromotionStrategy {
    const normalizedModel = businessModel.toLowerCase();

    const strategy = this.strategies.find((s) => s.canHandle(normalizedModel));

    if (!strategy) {
      this.logger.warn(`⚠️ No strategy found for model: ${businessModel}, falling back to retail`);
      return this.retailStrategy;
    }

    this.logger.log(`✅ Selected ${strategy.getStrategyName()} for model: ${businessModel}`);
    return strategy;
  }

  /**
   * Get strategy based on PROMOTION_MODE ENV (Dev mode)
   */
  private getStrategyByEnv(): IPromotionStrategy {
    const mode = this.configService.get<string>('PROMOTION_MODE', 'retail');
    return this.getStrategyByModel(mode);
  }

  // ============================================
  // PUBLIC API: Validation Methods
  // ============================================

  /**
   * Validate promotion using ENV mode (Dev)
   */
  async validatePromotionByEnv(
    params: PromotionValidationParams,
  ): Promise<PromotionValidationResult> {
    const strategy = this.getStrategyByEnv();
    return strategy.validatePromotion(params);
  }

  /**
   * Validate promotion using explicit model (Production)
   */
  async validatePromotionByModel(
    businessModel: string,
    params: PromotionValidationParams,
  ): Promise<PromotionValidationResult> {
    const strategy = this.getStrategyByModel(businessModel);
    return strategy.validatePromotion(params);
  }

  /**
   * Calculate discount using ENV mode (Dev)
   */
  async calculateDiscountByEnv(
    params: PromotionCalculationParams,
  ): Promise<number> {
    const strategy = this.getStrategyByEnv();
    return strategy.calculateDiscount(params);
  }

  /**
   * Calculate discount using explicit model (Production)
   */
  async calculateDiscountByModel(
    businessModel: string,
    params: PromotionCalculationParams,
  ): Promise<number> {
    const strategy = this.getStrategyByModel(businessModel);
    return strategy.calculateDiscount(params);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get all registered strategies
   */
  getAvailableStrategies(): string[] {
    return this.strategies.map((s) => s.getStrategyName());
  }

  /**
   * Get current ENV mode
   */
  getCurrentMode(): string {
    return this.configService.get<string>('PROMOTION_MODE', 'retail');
  }
}
