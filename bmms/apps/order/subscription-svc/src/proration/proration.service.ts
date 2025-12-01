import { Injectable } from '@nestjs/common';

/**
 * Proration calculation result
 */
export interface ProrationResult {
  // Credit from old plan (unused time)
  creditAmount: number;
  creditDays: number;

  // Charge for new plan (remaining time)
  chargeAmount: number;
  chargeDays: number;

  // Net amount (positive = charge customer, negative = credit customer)
  netAmount: number;

  // Calculation details
  oldPlanDailyRate: number;
  newPlanDailyRate: number;
  remainingDays: number;
  totalDaysInPeriod: number;

  // Effective date
  effectiveDate: Date;
  nextBillingDate: Date;
}

/**
 * Proration Service
 * Handles proration calculations for plan changes
 */
@Injectable()
export class ProrationService {
  /**
   * Calculate proration for plan change
   * 
   * @param oldAmount - Current plan amount
   * @param newAmount - New plan amount
   * @param currentPeriodStart - Start of current billing period
   * @param currentPeriodEnd - End of current billing period
   * @param changeDate - Date of plan change (default: now)
   * @param billingCycle - Billing cycle (monthly or yearly)
   * @returns ProrationResult with detailed calculations
   */
  calculateProration(
    oldAmount: number,
    newAmount: number,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    changeDate: Date = new Date(),
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): ProrationResult {
    // Ensure dates are Date objects
    const periodStart = new Date(currentPeriodStart);
    const periodEnd = new Date(currentPeriodEnd);
    let effectiveDate = new Date(changeDate);

    // Nới lỏng validation: Nếu changeDate nằm ngoài period, điều chỉnh về trong period
    if (effectiveDate < periodStart) {
      effectiveDate = periodStart;
    }
    if (effectiveDate > periodEnd) {
      // Nếu đã qua period end, tạo period mới từ hôm nay
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date();
      if (billingCycle === 'monthly') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }
      
      return {
        creditAmount: 0,
        creditDays: 0,
        chargeAmount: this.roundToTwoDecimals(newAmount),
        chargeDays: billingCycle === 'monthly' ? 30 : 365,
        netAmount: this.roundToTwoDecimals(newAmount),
        oldPlanDailyRate: 0,
        newPlanDailyRate: this.roundToTwoDecimals(newAmount / (billingCycle === 'monthly' ? 30 : 365)),
        remainingDays: billingCycle === 'monthly' ? 30 : 365,
        totalDaysInPeriod: billingCycle === 'monthly' ? 30 : 365,
        effectiveDate: newPeriodStart,
        nextBillingDate: newPeriodEnd,
      };
    }

    // Calculate total days in billing period
    const totalDaysInPeriod = Math.max(1, this.getDaysDifference(periodStart, periodEnd));

    // Calculate remaining days from change date to period end
    const remainingDays = Math.max(0, this.getDaysDifference(effectiveDate, periodEnd));

    // Calculate daily rates
    const oldPlanDailyRate = oldAmount / totalDaysInPeriod;
    const newPlanDailyRate = newAmount / totalDaysInPeriod;

    // Calculate credit (unused portion of old plan)
    const creditDays = remainingDays;
    const creditAmount = oldPlanDailyRate * creditDays;

    // Calculate charge (new plan for remaining days)
    const chargeDays = remainingDays;
    const chargeAmount = newPlanDailyRate * chargeDays;

    // Calculate net amount
    // Positive = customer owes money (upgrade)
    // Negative = customer gets credit (downgrade)
    const netAmount = chargeAmount - creditAmount;

    return {
      creditAmount: this.roundToTwoDecimals(creditAmount),
      creditDays,
      chargeAmount: this.roundToTwoDecimals(chargeAmount),
      chargeDays,
      netAmount: this.roundToTwoDecimals(netAmount),
      oldPlanDailyRate: this.roundToTwoDecimals(oldPlanDailyRate),
      newPlanDailyRate: this.roundToTwoDecimals(newPlanDailyRate),
      remainingDays,
      totalDaysInPeriod,
      effectiveDate,
      nextBillingDate: periodEnd,
    };
  }

  /**
   * Calculate proration for immediate plan change
   * Starts a new billing period immediately
   * 
   * @param oldAmount - Current plan amount
   * @param newAmount - New plan amount
   * @param currentPeriodStart - Start of current billing period
   * @param currentPeriodEnd - End of current billing period
   * @param changeDate - Date of plan change
   * @param billingCycle - Billing cycle
   * @returns ProrationResult
   */
  calculateImmediateChangeProration(
    oldAmount: number,
    newAmount: number,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    changeDate: Date = new Date(),
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): ProrationResult {
    const periodStart = new Date(currentPeriodStart);
    const periodEnd = new Date(currentPeriodEnd);
    const effectiveDate = new Date(changeDate);

    // Calculate total days in billing period
    const totalDaysInPeriod = this.getDaysDifference(periodStart, periodEnd);

    // Calculate remaining days from change date to period end
    const remainingDays = this.getDaysDifference(effectiveDate, periodEnd);

    // Calculate daily rate of old plan
    const oldPlanDailyRate = oldAmount / totalDaysInPeriod;

    // Credit for unused portion of old plan
    const creditAmount = oldPlanDailyRate * remainingDays;

    // Charge full amount for new plan (starts new period)
    const chargeAmount = newAmount;

    // Net amount (customer pays new plan minus credit)
    const netAmount = chargeAmount - creditAmount;

    // Calculate new billing period end
    const nextBillingDate = new Date(effectiveDate);
    if (billingCycle === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    return {
      creditAmount: this.roundToTwoDecimals(creditAmount),
      creditDays: remainingDays,
      chargeAmount: this.roundToTwoDecimals(chargeAmount),
      chargeDays: billingCycle === 'monthly' ? 30 : 365, // Approximate
      netAmount: this.roundToTwoDecimals(netAmount),
      oldPlanDailyRate: this.roundToTwoDecimals(oldPlanDailyRate),
      newPlanDailyRate: this.roundToTwoDecimals(newAmount / (billingCycle === 'monthly' ? 30 : 365)),
      remainingDays,
      totalDaysInPeriod,
      effectiveDate,
      nextBillingDate,
    };
  }

  /**
   * Determine if plan change is upgrade or downgrade
   */
  getChangeType(oldAmount: number, newAmount: number): 'upgrade' | 'downgrade' | 'sidegrade' {
    if (newAmount > oldAmount) {
      return 'upgrade';
    } else if (newAmount < oldAmount) {
      return 'downgrade';
    }
    return 'sidegrade';
  }

  /**
   * Generate proration description for customer
   */
  generateProrationDescription(proration: ProrationResult, changeType: string): string {
    const parts: string[] = [];

    if (proration.creditAmount > 0) {
      parts.push(
        `Credit for unused ${proration.creditDays} days of previous plan: $${proration.creditAmount.toFixed(2)}`
      );
    }

    parts.push(
      `Charge for ${proration.chargeDays} days of new plan: $${proration.chargeAmount.toFixed(2)}`
    );

    if (proration.netAmount > 0) {
      parts.push(`\nTotal due today: $${proration.netAmount.toFixed(2)}`);
    } else if (proration.netAmount < 0) {
      parts.push(`\nCredit applied: $${Math.abs(proration.netAmount).toFixed(2)}`);
    } else {
      parts.push('\nNo additional charge');
    }

    return parts.join('\n');
  }

  /**
   * Check if proration should be applied
   * Some businesses skip proration for small amounts
   */
  shouldApplyProration(netAmount: number, threshold: number = 1.0): boolean {
    return Math.abs(netAmount) >= threshold;
  }

  /**
   * Calculate refund amount for cancellation
   * Returns unused portion of current period
   */
  calculateCancellationRefund(
    amount: number,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancellationDate: Date = new Date()
  ): {
    refundAmount: number;
    refundDays: number;
    totalDays: number;
    dailyRate: number;
  } {
    const periodStart = new Date(currentPeriodStart);
    const periodEnd = new Date(currentPeriodEnd);
    const cancelDate = new Date(cancellationDate);

    const totalDays = this.getDaysDifference(periodStart, periodEnd);
    const refundDays = this.getDaysDifference(cancelDate, periodEnd);
    const dailyRate = amount / totalDays;
    const refundAmount = dailyRate * refundDays;

    return {
      refundAmount: this.roundToTwoDecimals(refundAmount),
      refundDays,
      totalDays,
      dailyRate: this.roundToTwoDecimals(dailyRate),
    };
  }

  /**
   * Helper: Calculate days difference between two dates
   */
  private getDaysDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Helper: Round to 2 decimal places
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Get proration policy description
   */
  getProrationPolicy(): string {
    return `
Proration Policy:
- Plan upgrades: You'll be charged the prorated difference for the remaining period
- Plan downgrades: Credit will be applied to your account for unused time
- Immediate changes: New plan starts immediately with credit for unused time
- Period-end changes: New plan starts at the end of current billing period
- Cancellations: Unused time may be refunded based on policy
    `.trim();
  }
}
