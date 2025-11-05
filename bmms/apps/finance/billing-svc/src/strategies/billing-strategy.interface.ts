/**
 * Billing Strategy Interface
 * 
 * Defines how billing is calculated and processed based on business model:
 * - Onetime: Retail purchases (pay once)
 * - Recurring: Subscription plans (monthly/yearly)
 * - Freemium: Free base + paid add-ons
 */

export interface IBillingStrategy {
  /**
   * Calculate billing amount based on model-specific rules
   */
  calculateAmount(params: BillingCalculationParams): Promise<BillingResult>;

  /**
   * Validate if this strategy can handle the given order/subscription
   */
  canHandle(businessModel: string): boolean;

  /**
   * Get strategy name for logging
   */
  getStrategyName(): string;
}

export interface BillingCalculationParams {
  orderId?: string;
  subscriptionId?: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  addons?: Array<{
    addonId: string;
    name: string;
    price: number;
  }>;
  metadata?: {
    businessModel?: string;
    billingPeriod?: 'monthly' | 'yearly' | 'onetime';
    isFreeTier?: boolean;
  };
}

export interface BillingResult {
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  billingMode: 'onetime' | 'recurring' | 'freemium' | 'addon_only';
  nextBillingDate?: Date; // For recurring
  addonCharges?: Array<{
    addonId: string;
    amount: number;
  }>;
}
