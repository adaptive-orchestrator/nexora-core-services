import { Injectable, Logger } from '@nestjs/common';
import {
  IBillingStrategy,
  BillingCalculationParams,
  BillingResult,
} from './billing-strategy.interface';

/**
 * Strategy 2: Recurring Billing (Subscription Model)
 * 
 * Characteristics:
 * - Monthly/yearly recurring payment
 * - Auto-renew on billing date
 * - Proration for mid-cycle changes
 */
@Injectable()
export class RecurringBillingStrategy implements IBillingStrategy {
  private readonly logger = new Logger(RecurringBillingStrategy.name);

  canHandle(businessModel: string): boolean {
    return businessModel === 'subscription' || businessModel === 'recurring';
  }

  getStrategyName(): string {
    return 'RecurringBillingStrategy';
  }

  async calculateAmount(params: BillingCalculationParams): Promise<BillingResult> {
    this.logger.log(`📊 Calculating RECURRING billing for subscription ${params.subscriptionId}`);

    // For subscription, typically one plan at a time
    const planPrice = params.items[0]?.unitPrice || 0;
    const subtotal = planPrice;

    // Tax calculation
    const taxRate = parseFloat(process.env.TAX_RATE || '0.1');
    const tax = subtotal * taxRate;

    // Discount from promotions
    const discount = 0; // TODO: Get from PromotionService

    const totalAmount = subtotal + tax - discount;

    // Calculate next billing date based on period
    const billingPeriod = params.metadata?.billingPeriod || 'monthly';
    const nextBillingDate = new Date();
    
    if (billingPeriod === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (billingPeriod === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    return {
      subtotal,
      tax,
      discount,
      totalAmount,
      billingMode: 'recurring',
      nextBillingDate,
    };
  }
}
