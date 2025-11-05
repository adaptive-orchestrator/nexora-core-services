import { Injectable, Logger } from '@nestjs/common';
import {
  IBillingStrategy,
  BillingCalculationParams,
  BillingResult,
} from './billing-strategy.interface';

/**
 * Strategy 1: One-time Billing (Retail Model)
 * 
 * Characteristics:
 * - Single payment for product purchase
 * - No recurring charges
 * - Simple subtotal + tax calculation
 */
@Injectable()
export class OnetimeBillingStrategy implements IBillingStrategy {
  private readonly logger = new Logger(OnetimeBillingStrategy.name);

  canHandle(businessModel: string): boolean {
    return businessModel === 'retail' || businessModel === 'onetime';
  }

  getStrategyName(): string {
    return 'OnetimeBillingStrategy';
  }

  async calculateAmount(params: BillingCalculationParams): Promise<BillingResult> {
    this.logger.log(`📊 Calculating ONETIME billing for order ${params.orderId}`);

    // Calculate subtotal from items
    const subtotal = params.items.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice;
    }, 0);

    // Calculate tax (10% VAT for Vietnam)
    const taxRate = parseFloat(process.env.TAX_RATE || '0.1');
    const tax = subtotal * taxRate;

    // Apply discount if any (from promotions)
    const discount = 0; // TODO: Get from PromotionService

    const totalAmount = subtotal + tax - discount;

    return {
      subtotal,
      tax,
      discount,
      totalAmount,
      billingMode: 'onetime',
    };
  }
}
