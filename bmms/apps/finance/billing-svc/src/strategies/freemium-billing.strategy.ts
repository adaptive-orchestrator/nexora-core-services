import { Injectable, Logger } from '@nestjs/common';
import {
  IBillingStrategy,
  BillingCalculationParams,
  BillingResult,
} from './billing-strategy.interface';

/**
 * Strategy 3: Freemium Billing (Free Base + Paid Add-ons)
 * 
 * Characteristics:
 * - Base plan is FREE (no charge)
 * - Only bill for add-ons (extra storage, premium features, etc.)
 * - Add-ons can be one-time or recurring
 * - Track add-on usage for metered billing
 */
@Injectable()
export class FreemiumBillingStrategy implements IBillingStrategy {
  private readonly logger = new Logger(FreemiumBillingStrategy.name);

  canHandle(businessModel: string): boolean {
    return businessModel === 'freemium' || businessModel === 'freemium_addon';
  }

  getStrategyName(): string {
    return 'FreemiumBillingStrategy';
  }

  async calculateAmount(params: BillingCalculationParams): Promise<BillingResult> {
    this.logger.log(`[Billing] Calculating FREEMIUM billing for customer ${params.customerId}`);

    // Base plan is FREE
    let subtotal = 0;

    // Check if this is a free tier user
    const isFreeTier = params.metadata?.isFreeTier ?? true;

    if (!isFreeTier) {
      // User upgraded to paid plan, charge base price
      subtotal = params.items[0]?.unitPrice || 0;
    }

    // Calculate add-on charges
    const addonCharges: Array<{ addonId: string; amount: number }> = [];
    
    if (params.addons && params.addons.length > 0) {
      this.logger.log(`[Billing] Processing ${params.addons.length} add-ons`);
      
      for (const addon of params.addons) {
        subtotal += addon.price;
        addonCharges.push({
          addonId: addon.addonId,
          amount: addon.price,
        });
        
        this.logger.log(`  → ${addon.name}: ${addon.price} VND`);
      }
    }

    // Tax calculation
    const taxRate = parseFloat(process.env.TAX_RATE || '0.1');
    const tax = subtotal * taxRate;

    // Discount
    const discount = 0;

    const totalAmount = subtotal + tax - discount;

    // Determine billing mode
    const billingMode = isFreeTier && addonCharges.length > 0 
      ? 'addon_only' 
      : 'freemium';

    this.logger.log(`[Billing] Total: ${totalAmount} VND (Base: ${isFreeTier ? 'FREE' : subtotal}, Add-ons: ${addonCharges.length})`);

    return {
      subtotal,
      tax,
      discount,
      totalAmount,
      billingMode,
      addonCharges: addonCharges.length > 0 ? addonCharges : undefined,
    };
  }
}
