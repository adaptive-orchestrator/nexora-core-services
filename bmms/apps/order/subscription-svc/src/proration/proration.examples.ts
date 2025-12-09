/**
 * Proration Service - Usage Examples
 * 
 * This file demonstrates how to use the ProrationService
 * in different scenarios.
 */

import { ProrationService } from './proration.service';

// Initialize service
const prorationService = new ProrationService();

// =============================================================================
// EXAMPLE 1: Mid-cycle Plan Upgrade (Immediate)
// =============================================================================

console.log('=== EXAMPLE 1: Mid-cycle Upgrade (Immediate) ===\n');

// Customer on $29.99/month Basic plan
// Upgrades to $49.99/month Pro plan on day 15 of 30
const upgrade = prorationService.calculateImmediateChangeProration(
  29.99,  // Old plan price
  49.99,  // New plan price
  new Date('2025-01-01'),  // Period start
  new Date('2025-01-31'),  // Period end
  new Date('2025-01-15'),  // Change date
  'monthly'
);

console.log('Proration Calculation:');
console.log(`- Old plan: $${upgrade.oldPlanDailyRate}/day × ${upgrade.creditDays} days = $${upgrade.creditAmount} credit`);
console.log(`- New plan: Full charge = $${upgrade.chargeAmount}`);
console.log(`- Net amount: $${upgrade.netAmount}`);
console.log(`- Next billing: ${upgrade.nextBillingDate.toDateString()}`);

const upgradeDesc = prorationService.generateProrationDescription(upgrade, 'upgrade');
console.log('\nCustomer message:');
console.log(upgradeDesc);

/*
Expected Output:
Proration Calculation:
- Old plan: $1.00/day × 16 days = $16.00 credit
- New plan: Full charge = $49.99
- Net amount: $33.99
- Next billing: Mon Feb 15 2025

Customer message:
Credit for unused 16 days of previous plan: $16.00
Charge for 16 days of new plan: $49.99
Total due today: $33.99
*/

// =============================================================================
// EXAMPLE 2: Mid-cycle Plan Downgrade (Period-End)
// =============================================================================

console.log('\n\n=== EXAMPLE 2: Mid-cycle Downgrade (Period-End) ===\n');

// Customer on $49.99/month Pro plan
// Downgrades to $29.99/month Basic plan
// Wants to keep Pro features until period ends
const downgrade = prorationService.calculateProration(
  49.99,  // Old plan price
  29.99,  // New plan price
  new Date('2025-01-01'),  // Period start
  new Date('2025-01-31'),  // Period end
  new Date('2025-01-20'),  // Change date
  'monthly'
);

console.log('Proration Calculation:');
console.log(`- Old plan credit: $${downgrade.creditAmount}`);
console.log(`- New plan charge: $${downgrade.chargeAmount}`);
console.log(`- Net amount: $${downgrade.netAmount}`);
console.log(`- Change takes effect: ${downgrade.nextBillingDate.toDateString()}`);

if (downgrade.netAmount < 0) {
  console.log(`\n[Proration] Customer receives $${Math.abs(downgrade.netAmount)} credit`);
}

/*
Expected Output:
Proration Calculation:
- Old plan credit: $18.33
- New plan charge: $10.99
- Net amount: -$7.34
- Change takes effect: Fri Jan 31 2025

Customer receives $7.34 credit
*/

// =============================================================================
// EXAMPLE 3: Yearly Plan Change
// =============================================================================

console.log('\n\n=== EXAMPLE 3: Yearly Plan Upgrade ===\n');

// Customer on $299/year plan
// Upgrades to $599/year plan mid-year
const yearlyUpgrade = prorationService.calculateProration(
  299,
  599,
  new Date('2025-01-01'),
  new Date('2025-12-31'),
  new Date('2025-07-01'),  // Mid-year
  'yearly'
);

console.log('Proration Calculation:');
console.log(`- Total days in period: ${yearlyUpgrade.totalDaysInPeriod}`);
console.log(`- Remaining days: ${yearlyUpgrade.remainingDays}`);
console.log(`- Old daily rate: $${yearlyUpgrade.oldPlanDailyRate}`);
console.log(`- New daily rate: $${yearlyUpgrade.newPlanDailyRate}`);
console.log(`- Credit: $${yearlyUpgrade.creditAmount}`);
console.log(`- Charge: $${yearlyUpgrade.chargeAmount}`);
console.log(`- Net: $${yearlyUpgrade.netAmount}`);

/*
Expected Output:
Proration Calculation:
- Total days in period: 364
- Remaining days: 184
- Old daily rate: $0.82
- New daily rate: $1.65
- Credit: $150.88
- Charge: $303.60
- Net: $152.72
*/

// =============================================================================
// EXAMPLE 4: Cancellation Refund
// =============================================================================

console.log('\n\n=== EXAMPLE 4: Subscription Cancellation ===\n');

// Customer cancels $49.99/month plan on day 10
const refund = prorationService.calculateCancellationRefund(
  49.99,
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  new Date('2025-01-10')
);

console.log('Cancellation Refund:');
console.log(`- Total days paid: ${refund.totalDays}`);
console.log(`- Days used: ${refund.totalDays - refund.refundDays}`);
console.log(`- Days unused: ${refund.refundDays}`);
console.log(`- Daily rate: $${refund.dailyRate}`);
console.log(`- Refund amount: $${refund.refundAmount}`);

/*
Expected Output:
Cancellation Refund:
- Total days paid: 30
- Days used: 9
- Days unused: 21
- Daily rate: $1.67
- Refund amount: $35.07
*/

// =============================================================================
// EXAMPLE 5: Change Type Detection
// =============================================================================

console.log('\n\n=== EXAMPLE 5: Change Type Detection ===\n');

const changes = [
  { from: 29.99, to: 49.99 },
  { from: 49.99, to: 29.99 },
  { from: 39.99, to: 39.99 },
];

changes.forEach(change => {
  const type = prorationService.getChangeType(change.from, change.to);
  console.log(`$${change.from} → $${change.to} = ${type}`);
});

/*
Expected Output:
$29.99 → $49.99 = upgrade
$49.99 → $29.99 = downgrade
$39.99 → $39.99 = sidegrade
*/

// =============================================================================
// EXAMPLE 6: Minimum Threshold Check
// =============================================================================

console.log('\n\n=== EXAMPLE 6: Minimum Threshold ===\n');

// Small price difference - should we charge?
const smallChange = prorationService.calculateProration(
  29.99,
  31.99,  // Only $2 difference
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  new Date('2025-01-28'),  // Only 3 days left
  'monthly'
);

console.log(`Net amount: $${smallChange.netAmount}`);
console.log(`Should apply proration? ${prorationService.shouldApplyProration(smallChange.netAmount)}`);

/*
Expected Output:
Net amount: $0.20
Should apply proration? false (below $1.00 threshold)
*/

// =============================================================================
// EXAMPLE 7: Complete Plan Change Flow
// =============================================================================

console.log('\n\n=== EXAMPLE 7: Complete Plan Change Flow ===\n');

interface Plan {
  id: number;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
}

interface Subscription {
  id: number;
  customerId: number;
  planId: number;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

async function simulateChangePlan(
  subscription: Subscription,
  newPlan: Plan,
  immediate: boolean = false
) {
  console.log(`\nChanging plan for subscription #${subscription.id}`);
  console.log(`Current: $${subscription.amount}/${subscription.billingCycle}`);
  console.log(`New: ${newPlan.name} - $${newPlan.price}/${newPlan.billingCycle}`);
  console.log(`Mode: ${immediate ? 'Immediate' : 'Period-end'}`);
  
  // Calculate proration
  let proration;
  if (immediate) {
    proration = prorationService.calculateImmediateChangeProration(
      subscription.amount,
      newPlan.price,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      new Date(),
      newPlan.billingCycle
    );
  } else {
    proration = prorationService.calculateProration(
      subscription.amount,
      newPlan.price,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      new Date(),
      newPlan.billingCycle
    );
  }
  
  const changeType = prorationService.getChangeType(subscription.amount, newPlan.price);
  const description = prorationService.generateProrationDescription(proration, changeType);
  
  console.log(`\n${description}`);
  
  // Determine action
  if (prorationService.shouldApplyProration(proration.netAmount)) {
    if (proration.netAmount > 0) {
      console.log(`\n[Proration] Action: Charge customer $${proration.netAmount}`);
      console.log(`   → Create invoice for proration charge`);
    } else {
      console.log(`\n[Proration] Action: Issue $${Math.abs(proration.netAmount)} credit`);
      console.log(`   → Add credit to customer account`);
    }
  } else {
    console.log('\n[Proration] Action: No charge (amount below threshold)');
  }
  
  // Update subscription
  console.log('\n[Proration] Update subscription:');
  console.log(`   - planId: ${subscription.planId} → ${newPlan.id}`);
  console.log(`   - amount: $${subscription.amount} → $${newPlan.price}`);
  if (immediate) {
    console.log(`   - currentPeriodStart: ${new Date()}`);
    console.log(`   - currentPeriodEnd: ${proration.nextBillingDate}`);
  }
  console.log(`   - metadata.lastProration: { ... }`);
  
  return proration;
}

// Simulate upgrade
const mockSubscription: Subscription = {
  id: 123,
  customerId: 456,
  planId: 1,
  amount: 29.99,
  billingCycle: 'monthly',
  currentPeriodStart: new Date('2025-01-01'),
  currentPeriodEnd: new Date('2025-01-31'),
};

const mockNewPlan: Plan = {
  id: 2,
  name: 'Pro Plan',
  price: 49.99,
  billingCycle: 'monthly',
};

simulateChangePlan(mockSubscription, mockNewPlan, true);

// =============================================================================
// EXAMPLE 8: Proration Policy
// =============================================================================

console.log('\n\n=== EXAMPLE 8: Proration Policy ===\n');
console.log(prorationService.getProrationPolicy());

// =============================================================================
// EXAMPLE 9: Error Handling
// =============================================================================

console.log('\n\n=== EXAMPLE 9: Error Handling ===\n');

try {
  // Invalid: change date outside period
  prorationService.calculateProration(
    29.99,
    49.99,
    new Date('2025-01-01'),
    new Date('2025-01-31'),
    new Date('2025-02-15'),  // Outside period!
    'monthly'
  );
} catch (error) {
  console.log(`[Proration] Error caught: ${error.message}`);
}

// =============================================================================
// Summary
// =============================================================================

console.log('\n\n=== Summary ===\n');
console.log('[Proration] ProrationService provides:');
console.log('  1. Period-end plan changes (no immediate charge)');
console.log('  2. Immediate plan changes (with fair proration)');
console.log('  3. Cancellation refund calculations');
console.log('  4. Upgrade/downgrade detection');
console.log('  5. Customer-friendly descriptions');
console.log('  6. Minimum threshold checking');
console.log('  7. Comprehensive error handling');
console.log('\n[Proration] Ready for production use!');
