/**
 * Promotion Strategy Interface
 * 
 * Defines how promotions are validated and applied based on business model:
 * - Retail: Discount codes, percentage off, BOGO
 * - Subscription: Free trial, first-month discount, annual discount
 * - Freemium: Add-on bundles, upgrade discounts
 */

export interface IPromotionStrategy {
  /**
   * Validate if promotion can be applied to this business model
   */
  validatePromotion(params: PromotionValidationParams): Promise<PromotionValidationResult>;

  /**
   * Calculate discount amount based on model-specific rules
   */
  calculateDiscount(params: PromotionCalculationParams): Promise<number>;

  /**
   * Check if this strategy can handle the business model
   */
  canHandle(businessModel: string): boolean;

  /**
   * Get strategy name for logging
   */
  getStrategyName(): string;
}

export interface PromotionValidationParams {
  promotionCode: string;
  customerId?: number;           // Optional in dev mode
  userId?: number;               // Alternative to customerId
  businessModel?: string;
  orderAmount?: number;          // For retail
  subscriptionPlanId?: number;   // For subscription
  addonIds?: string[] | number[]; // For freemium (support both types)
}

export interface PromotionValidationResult {
  isValid: boolean;
  reason?: string;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed' | 'free_trial' | 'bundle';
  metadata?: Record<string, any>;
}

export interface PromotionCalculationParams {
  promotionType: string;
  promotionValue: number;
  orderAmount?: number;
  items?: Array<{ productId: string; price: number; quantity: number }>;
}
