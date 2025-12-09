// import { Test, TestingModule } from '@nestjs/testing';
// import { INestApplication } from '@nestjs/common';
// import { ClientsModule, Transport } from '@nestjs/microservices';
// import * as request from 'supertest';

// /**
//  * E2E Test Suite for Subscription Flow
//  * 
//  * Tests the complete subscription lifecycle:
//  * 1. Create subscription with trial
//  * 2. Trial period handling
//  * 3. Payment and activation
//  * 4. Renewal
//  * 5. Plan changes (upgrade/downgrade with proration)
//  * 6. Pause and resume
//  * 7. Cancellation
//  * 
//  * Prerequisites:
//  * - MySQL databases running (subscription_db, catalogue_db, customer_db, billing_db)
//  * - Kafka broker running
//  * - All microservices running (subscription-svc, catalogue-svc, customer-svc, billing-svc, promotion-svc)
//  */

// describe('Subscription E2E Tests', () => {
//   let app: INestApplication;
//   let subscriptionId: number;
//   let customerId: number = 1;
//   let basicPlanId: number = 1;
//   let proPlanId: number = 2;
//   let promotionCode: string = 'TEST50';

//   // API Gateway base URL
//   const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

//   beforeAll(async () => {
//     console.log('[Test] Starting Subscription E2E Tests...\n');
//   });

//   afterAll(async () => {
//     console.log('\n[Test] Subscription E2E Tests completed');
//   });

//   /**
//    * TEST 1: Create subscription with trial period
//    */
//   describe('1. Create Subscription with Trial', () => {
//     it('should create a subscription with 14-day trial', async () => {
//       console.log('\n[Test] Test 1: Creating subscription with trial...');

//       const createDto = {
//         customerId: customerId,
//         planId: basicPlanId,
//         billingCycle: 'monthly',
//         useTrial: true,
//       };

//       const response = await request(API_BASE_URL)
//         .post('/subscriptions')
//         .send(createDto)
//         .expect(201);

//       expect(response.body).toHaveProperty('id');
//       expect(response.body.status).toBe('trial');
//       expect(response.body.customerId).toBe(customerId);
//       expect(response.body.planId).toBe(basicPlanId);
//       expect(response.body.isTrialUsed).toBe(true);
//       expect(response.body.trialStart).toBeDefined();
//       expect(response.body.trialEnd).toBeDefined();

//       subscriptionId = response.body.id;

//       console.log(`[Test] Subscription created: ID=${subscriptionId}, Status=${response.body.status}`);
//       console.log(`   Trial period: ${response.body.trialStart} to ${response.body.trialEnd}`);
//     });

//     it('should not allow creating second subscription with trial for same customer', async () => {
//       console.log('\n[Test] Test 1b: Attempting to create second trial subscription...');

//       const createDto = {
//         customerId: customerId,
//         planId: basicPlanId,
//         billingCycle: 'monthly',
//         useTrial: true,
//       };

//       const response = await request(API_BASE_URL)
//         .post('/subscriptions')
//         .send(createDto)
//         .expect(400);

//       expect(response.body.message).toContain('trial already used');

//       console.log('[Test] Correctly rejected second trial subscription');
//     });
//   });

//   /**
//    * TEST 2: Get subscription details
//    */
//   describe('2. Get Subscription Details', () => {
//     it('should retrieve subscription by ID', async () => {
//       console.log('\n[Test] Test 2: Getting subscription details...');

//       const response = await request(API_BASE_URL)
//         .get(`/subscriptions/${subscriptionId}`)
//         .expect(200);

//       expect(response.body.id).toBe(subscriptionId);
//       expect(response.body.status).toBe('trial');

//       console.log(`[Test] Retrieved subscription: ${JSON.stringify(response.body, null, 2)}`);
//     });

//     it('should list all subscriptions for customer', async () => {
//       console.log('\n[Test] Test 2b: Listing customer subscriptions...');

//       const response = await request(API_BASE_URL)
//         .get(`/subscriptions/customer/${customerId}`)
//         .expect(200);

//       expect(Array.isArray(response.body)).toBe(true);
//       expect(response.body.length).toBeGreaterThan(0);
//       expect(response.body.some(s => s.id === subscriptionId)).toBe(true);

//       console.log(`[Test] Found ${response.body.length} subscription(s) for customer ${customerId}`);
//     });
//   });

//   /**
//    * TEST 3: Apply promotion code during trial
//    */
//   describe('3. Apply Promotion Code', () => {
//     it('should apply promotion code to subscription', async () => {
//       console.log('\n[Test] Test 3: Applying promotion code...');

//       const applyDto = {
//         code: promotionCode,
//         subscriptionId: subscriptionId,
//         customerId: customerId,
//       };

//       const response = await request(API_BASE_URL)
//         .post('/promotions/apply')
//         .send(applyDto)
//         .expect(200);

//       expect(response.body).toHaveProperty('discount');
//       expect(response.body.code).toBe(promotionCode);

//       console.log(`[Test] Promotion applied: ${response.body.discount}% off`);
//     });
//   });

//   /**
//    * TEST 4: Trial to Active conversion (payment)
//    */
//   describe('4. Convert Trial to Active (Payment)', () => {
//     it('should convert trial subscription to active after payment', async () => {
//       console.log('\n[Test] Test 4: Converting trial to active...');

//       // Simulate payment success
//       const paymentDto = {
//         subscriptionId: subscriptionId,
//         amount: 29.99,
//         paymentMethod: 'credit_card',
//       };

//       const response = await request(API_BASE_URL)
//         .post('/payments/process')
//         .send(paymentDto)
//         .expect(200);

//       expect(response.body.status).toBe('success');

//       // Wait for event processing
//       await new Promise(resolve => setTimeout(resolve, 2000));

//       // Check subscription status updated
//       const subResponse = await request(API_BASE_URL)
//         .get(`/subscriptions/${subscriptionId}`)
//         .expect(200);

//       expect(subResponse.body.status).toBe('active');

//       console.log('[Test] Subscription activated after payment');
//     });
//   });

//   /**
//    * TEST 5: Plan change - Upgrade with proration
//    */
//   describe('5. Plan Change - Upgrade (with Proration)', () => {
//     it('should upgrade plan with prorated charge', async () => {
//       console.log('\n[Test] Test 5: Upgrading plan with proration...');

//       const changePlanDto = {
//         newPlanId: proPlanId,
//         immediate: true,
//       };

//       const response = await request(API_BASE_URL)
//         .put(`/subscriptions/${subscriptionId}/change-plan`)
//         .send(changePlanDto)
//         .expect(200);

//       expect(response.body.planId).toBe(proPlanId);
//       expect(response.body.metadata).toHaveProperty('lastProration');
//       expect(response.body.metadata.lastProration.changeType).toBe('upgrade');
//       expect(response.body.metadata.lastProration.netAmount).toBeGreaterThan(0);

//       console.log('[Test] Plan upgraded successfully');
//       console.log(`   Proration charge: $${response.body.metadata.lastProration.netAmount}`);
//       console.log(`   New amount: $${response.body.amount}/month`);
//     });

//     it('should have created proration invoice', async () => {
//       console.log('\n[Test] Test 5b: Checking proration invoice...');

//       // Wait for invoice creation
//       await new Promise(resolve => setTimeout(resolve, 2000));

//       const response = await request(API_BASE_URL)
//         .get(`/invoices/customer/${customerId}`)
//         .expect(200);

//       const prorationInvoice = response.body.find(
//         inv => inv.invoiceType === 'proration_charge'
//       );

//       expect(prorationInvoice).toBeDefined();
//       expect(prorationInvoice.amount).toBeGreaterThan(0);

//       console.log(`[Test] Proration invoice created: $${prorationInvoice.amount}`);
//     });
//   });

//   /**
//    * TEST 6: Plan change - Downgrade with credit
//    */
//   describe('6. Plan Change - Downgrade (with Credit)', () => {
//     it('should downgrade plan and issue credit', async () => {
//       console.log('\n[Test] Test 6: Downgrading plan...');

//       const changePlanDto = {
//         newPlanId: basicPlanId,
//         immediate: false, // Change at period end
//       };

//       const response = await request(API_BASE_URL)
//         .put(`/subscriptions/${subscriptionId}/change-plan`)
//         .send(changePlanDto)
//         .expect(200);

//       expect(response.body.planId).toBe(basicPlanId);

//       console.log('[Test] Plan downgrade scheduled for period end');
//     });
//   });

//   /**
//    * TEST 7: Pause subscription
//    */
//   describe('7. Pause Subscription', () => {
//     it('should pause active subscription', async () => {
//       console.log('\n[Test] Test 7: Pausing subscription...');

//       const pauseDto = {
//         reason: 'Customer request - temporary hold',
//       };

//       const response = await request(API_BASE_URL)
//         .put(`/subscriptions/${subscriptionId}/pause`)
//         .send(pauseDto)
//         .expect(200);

//       expect(response.body.status).toBe('paused');

//       console.log('[Test] Subscription paused');
//     });

//     it('should resume paused subscription', async () => {
//       console.log('\n[Test] Test 7b: Resuming subscription...');

//       const response = await request(API_BASE_URL)
//         .put(`/subscriptions/${subscriptionId}/resume`)
//         .expect(200);

//       expect(response.body.status).toBe('active');

//       console.log('[Test] Subscription resumed');
//     });
//   });

//   /**
//    * TEST 8: Subscription history
//    */
//   describe('8. Subscription History', () => {
//     it('should retrieve subscription history', async () => {
//       console.log('\n[Test] Test 8: Getting subscription history...');

//       const response = await request(API_BASE_URL)
//         .get(`/subscriptions/${subscriptionId}/history`)
//         .expect(200);

//       expect(Array.isArray(response.body)).toBe(true);
//       expect(response.body.length).toBeGreaterThan(0);

//       // Should have history for: creation, payment, plan changes, pause, resume
//       const actions = response.body.map(h => h.action);
//       expect(actions).toContain('created');
//       expect(actions).toContain('plan_changed');
//       expect(actions).toContain('paused');
//       expect(actions).toContain('resumed');

//       console.log(`[Test] History retrieved: ${response.body.length} events`);
//       console.log('   Actions:', actions.join(', '));
//     });
//   });

//   /**
//    * TEST 9: Renewal (simulate)
//    */
//   describe('9. Subscription Renewal', () => {
//     it('should renew subscription automatically', async () => {
//       console.log('\n[Test] Test 9: Testing renewal...');

//       // Call renewal endpoint (normally called by scheduler)
//       const response = await request(API_BASE_URL)
//         .post(`/subscriptions/${subscriptionId}/renew`)
//         .expect(200);

//       expect(response.body.status).toBe('active');
//       expect(response.body.currentPeriodStart).toBeDefined();
//       expect(response.body.currentPeriodEnd).toBeDefined();

//       console.log('[Test] Subscription renewed successfully');
//       console.log(`   Next billing: ${response.body.currentPeriodEnd}`);
//     });

//     it('should create renewal invoice', async () => {
//       console.log('\n[Test] Test 9b: Checking renewal invoice...');

//       await new Promise(resolve => setTimeout(resolve, 2000));

//       const response = await request(API_BASE_URL)
//         .get(`/invoices/subscription/${subscriptionId}`)
//         .expect(200);

//       const renewalInvoice = response.body.find(
//         inv => inv.invoiceType === 'recurring'
//       );

//       expect(renewalInvoice).toBeDefined();

//       console.log(`[Test] Renewal invoice created: $${renewalInvoice.amount}`);
//     });
//   });

//   /**
//    * TEST 10: Payment failure handling
//    */
//   describe('10. Payment Failure', () => {
//     it('should mark subscription as past_due on payment failure', async () => {
//       console.log('\n[Test] Test 10: Simulating payment failure...');

//       // Simulate payment failure
//       const failDto = {
//         subscriptionId: subscriptionId,
//         reason: 'insufficient_funds',
//       };

//       const response = await request(API_BASE_URL)
//         .post('/payments/fail')
//         .send(failDto)
//         .expect(200);

//       await new Promise(resolve => setTimeout(resolve, 2000));

//       // Check subscription status
//       const subResponse = await request(API_BASE_URL)
//         .get(`/subscriptions/${subscriptionId}`)
//         .expect(200);

//       expect(subResponse.body.status).toBe('past_due');

//       console.log('[Test] Subscription marked as past_due after payment failure');
//     });

//     it('should reactivate after successful payment', async () => {
//       console.log('\n[Test] Test 10b: Retrying payment...');

//       const retryDto = {
//         subscriptionId: subscriptionId,
//         amount: 29.99,
//         paymentMethod: 'credit_card',
//       };

//       await request(API_BASE_URL)
//         .post('/payments/retry')
//         .send(retryDto)
//         .expect(200);

//       await new Promise(resolve => setTimeout(resolve, 2000));

//       const subResponse = await request(API_BASE_URL)
//         .get(`/subscriptions/${subscriptionId}`)
//         .expect(200);

//       expect(subResponse.body.status).toBe('active');

//       console.log('[Test] Subscription reactivated after successful payment');
//     });
//   });

//   /**
//    * TEST 11: Cancellation
//    */
//   describe('11. Cancel Subscription', () => {
//     it('should cancel at period end', async () => {
//       console.log('\n[Test] Test 11: Cancelling subscription...');

//       const cancelDto = {
//         reason: 'No longer needed',
//         immediate: false, // Cancel at period end
//       };

//       const response = await request(API_BASE_URL)
//         .delete(`/subscriptions/${subscriptionId}`)
//         .send(cancelDto)
//         .expect(200);

//       expect(response.body.cancelAtPeriodEnd).toBe(true);
//       expect(response.body.cancelledAt).toBeDefined();
//       expect(response.body.cancellationReason).toBe(cancelDto.reason);

//       console.log('[Test] Subscription scheduled for cancellation at period end');
//       console.log(`   Cancellation date: ${response.body.currentPeriodEnd}`);
//     });

//     it('should show cancelled status after period ends', async () => {
//       console.log('\n[Test] Test 11b: Checking cancelled status...');

//       // In real scenario, this would happen after period ends
//       // For testing, we can manually trigger it
//       const response = await request(API_BASE_URL)
//         .post(`/subscriptions/${subscriptionId}/process-cancellation`)
//         .expect(200);

//       expect(response.body.status).toBe('cancelled');

//       console.log('[Test] Subscription cancelled successfully');
//     });
//   });

//   /**
//    * TEST 12: Create subscription without trial
//    */
//   describe('12. Create Subscription without Trial', () => {
//     it('should create subscription without trial (customer already used trial)', async () => {
//       console.log('\n[Test] Test 12: Creating subscription without trial...');

//       const createDto = {
//         customerId: customerId,
//         planId: proPlanId,
//         billingCycle: 'yearly',
//         useTrial: false,
//       };

//       const response = await request(API_BASE_URL)
//         .post('/subscriptions')
//         .send(createDto)
//         .expect(201);

//       expect(response.body.status).toBe('active');
//       expect(response.body.isTrialUsed).toBe(false);
//       expect(response.body.trialStart).toBeNull();
//       expect(response.body.trialEnd).toBeNull();

//       console.log(`[Test] Non-trial subscription created: ID=${response.body.id}`);
//       console.log(`   Billing cycle: ${response.body.billingCycle}`);
//     });
//   });

//   /**
//    * TEST 13: Multiple subscriptions for one customer
//    */
//   describe('13. Multiple Subscriptions', () => {
//     it('should allow multiple active subscriptions for different plans', async () => {
//       console.log('\n[Test] Test 13: Creating second subscription for customer...');

//       const createDto = {
//         customerId: customerId,
//         planId: basicPlanId,
//         billingCycle: 'monthly',
//         useTrial: false,
//       };

//       const response = await request(API_BASE_URL)
//         .post('/subscriptions')
//         .send(createDto)
//         .expect(201);

//       expect(response.body.customerId).toBe(customerId);

//       // List all subscriptions
//       const listResponse = await request(API_BASE_URL)
//         .get(`/subscriptions/customer/${customerId}`)
//         .expect(200);

//       expect(listResponse.body.length).toBeGreaterThanOrEqual(2);

//       console.log(`[Test] Customer now has ${listResponse.body.length} subscriptions`);
//     });
//   });

//   /**
//    * TEST 14: Expired subscription handling
//    */
//   describe('14. Expired Subscriptions', () => {
//     it('should mark subscription as expired after grace period', async () => {
//       console.log('\n[Test] Test 14: Testing expired subscription handling...');

//       // Create a subscription that's past due
//       const createDto = {
//         customerId: customerId + 1, // Different customer
//         planId: basicPlanId,
//         billingCycle: 'monthly',
//         useTrial: false,
//       };

//       const createResponse = await request(API_BASE_URL)
//         .post('/subscriptions')
//         .send(createDto)
//         .expect(201);

//       const newSubId = createResponse.body.id;

//       // Simulate expiration (normally done by scheduler)
//       const expireResponse = await request(API_BASE_URL)
//         .post(`/subscriptions/${newSubId}/expire`)
//         .expect(200);

//       expect(expireResponse.body.status).toBe('expired');

//       console.log('[Test] Subscription marked as expired');
//     });
//   });
// });
