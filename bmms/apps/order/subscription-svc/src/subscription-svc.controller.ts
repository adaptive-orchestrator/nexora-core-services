import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { subscriptionSvcService } from './subscription-svc.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscriptionStatus } from './entities/subscription.entity';
import { debug } from '@bmms/common';

@Controller()
export class subscriptionSvcController {
  constructor(private readonly subscriptionSvcService: subscriptionSvcService) {}

  @GrpcMethod('SubscriptionService', 'CreateSubscription')
  async createSubscription(data: any) {
    try {
      const dto: CreateSubscriptionDto = {
        customerId: data.customerId,
        ownerId: data.ownerId,
        planId: data.planId,
        promotionCode: data.promotionCode,
        useTrial: data.useTrial,
      };

      const subscription = await this.subscriptionSvcService.create(dto);

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          ownerId: subscription.ownerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Subscription created successfully',
      };
    } catch (error) {
      debug.error('[gRPC CreateSubscription] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionById')
  async getSubscriptionById(data: { id: string }) {
    try {
      const subscription = await this.subscriptionSvcService.findById(data.id);

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          ownerId: subscription.ownerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Subscription found',
      };
    } catch (error) {
      console.error('[gRPC GetSubscriptionById] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionsByCustomer')
  async getSubscriptionsByCustomer(data: { customerId: string }) {
    try {
      const subscriptions = await this.subscriptionSvcService.listByCustomer(data.customerId);

      return {
        subscriptions: subscriptions.map((sub) => ({
          id: sub.id,
          customerId: sub.customerId,
          ownerId: sub.ownerId,
          planId: sub.planId,
          planName: sub.planName,
          amount: sub.amount,
          billingCycle: sub.billingCycle,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart?.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
          isTrialUsed: sub.isTrialUsed,
          trialStart: sub.trialStart?.toISOString() || '',
          trialEnd: sub.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          cancelledAt: sub.cancelledAt?.toISOString() || '',
          cancellationReason: sub.cancellationReason || '',
          createdAt: sub.createdAt?.toISOString(),
          updatedAt: sub.updatedAt?.toISOString(),
        })),
      };
    } catch (error) {
      console.error('[gRPC GetSubscriptionsByCustomer] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionsByOwner')
  async getSubscriptionsByOwner(data: { ownerId: string }) {
    try {
      const subscriptions = await this.subscriptionSvcService.listByOwner(data.ownerId);

      return {
        subscriptions: subscriptions.map((sub) => ({
          id: sub.id,
          customerId: sub.customerId,
          ownerId: sub.ownerId,
          planId: sub.planId,
          planName: sub.planName,
          amount: sub.amount,
          billingCycle: sub.billingCycle,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart?.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
          isTrialUsed: sub.isTrialUsed,
          trialStart: sub.trialStart?.toISOString() || '',
          trialEnd: sub.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          cancelledAt: sub.cancelledAt?.toISOString() || '',
          cancellationReason: sub.cancellationReason || '',
          createdAt: sub.createdAt?.toISOString(),
          updatedAt: sub.updatedAt?.toISOString(),
        })),
      };
    } catch (error) {
      console.error('[gRPC GetSubscriptionsByOwner] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'CancelSubscription')
  async cancelSubscription(data: any) {
    try {
      const dto: CancelSubscriptionDto = {
        reason: data.reason,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      };

      const subscription = await this.subscriptionSvcService.cancel(data.id, dto);

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Subscription cancelled successfully',
      };
    } catch (error) {
      console.error('[gRPC CancelSubscription] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'RenewSubscription')
  async renewSubscription(data: { id: string }) {
    try {
      const subscription = await this.subscriptionSvcService.renew(data.id);

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Subscription renewed successfully',
      };
    } catch (error) {
      console.error('[gRPC RenewSubscription] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'ChangePlan')
  async changePlan(data: any) {
    try {
      const dto: ChangePlanDto = {
        newPlanId: data.newPlanId,
        immediate: data.immediate,
      };

      const subscription = await this.subscriptionSvcService.changePlan(data.id, dto);

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Plan changed successfully',
      };
    } catch (error) {
      console.error('[gRPC ChangePlan] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'UpdateSubscriptionStatus')
  async updateSubscriptionStatus(data: any) {
    try {
      const subscription = await this.subscriptionSvcService.updateStatus(
        data.id,
        data.newStatus as SubscriptionStatus,
        data.reason
      );

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Subscription status updated successfully',
      };
    } catch (error) {
      console.error('[gRPC UpdateSubscriptionStatus] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetAllSubscriptions')
  async getAllSubscriptions() {
    try {
      const subscriptions = await this.subscriptionSvcService.findAll();

      return {
        subscriptions: subscriptions.map((sub) => ({
          id: sub.id,
          customerId: sub.customerId,
          planId: sub.planId,
          planName: sub.planName,
          amount: sub.amount,
          billingCycle: sub.billingCycle,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart?.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
          isTrialUsed: sub.isTrialUsed,
          trialStart: sub.trialStart?.toISOString() || '',
          trialEnd: sub.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          cancelledAt: sub.cancelledAt?.toISOString() || '',
          cancellationReason: sub.cancellationReason || '',
          createdAt: sub.createdAt?.toISOString(),
          updatedAt: sub.updatedAt?.toISOString(),
        })),
        message: 'All subscriptions retrieved',
      };
    } catch (error) {
      debug.error('[gRPC GetAllSubscriptions] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'CheckTrialExpiry')
  async checkTrialExpiry() {
    try {
      debug.log('[SubscriptionController] Manual trigger: Checking trial expiry...');
      const result = await this.subscriptionSvcService.checkAndProcessTrialExpiry();
      
      return {
        processed: result.processed,
        converted: result.converted,
        failed: result.failed,
        message: `Processed ${result.processed} subscriptions. Converted: ${result.converted}, Failed: ${result.failed}`,
      };
    } catch (error) {
      debug.error('[gRPC CheckTrialExpiry] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionStats')
  async getSubscriptionStats() {
    try {
      const stats = await this.subscriptionSvcService.getStats();
      return stats;
    } catch (error) {
      debug.error('[gRPC GetSubscriptionStats] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'ActivateSubscription')
  async activateSubscription(data: { subscriptionId: string }) {
    try {
      debug.log(`[SubscriptionController] Activating subscription ${data.subscriptionId}...`);
      const subscription = await this.subscriptionSvcService.activateSubscription(data.subscriptionId);
      
      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          status: subscription.status,
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Subscription activated successfully',
      };
    } catch (error) {
      debug.error('[gRPC ActivateSubscription] Error:', error);
      throw error;
    }
  }

  // =================== STRIPE INTEGRATION GRPC HANDLERS ===================

  @GrpcMethod('SubscriptionService', 'CheckSubscriptionStatus')
  async checkSubscriptionStatus(data: { customerId: string }) {
    try {
      debug.log(`[SubscriptionController] Checking subscription status for ${data.customerId}...`);
      const result = await this.subscriptionSvcService.checkSubscriptionStatus(data.customerId);
      return result;
    } catch (error) {
      debug.error('[gRPC CheckSubscriptionStatus] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetPlanLimits')
  async getPlanLimits(data: { customerId: string; planId?: string }) {
    try {
      debug.log(`[SubscriptionController] Getting plan limits for ${data.customerId}...`);
      const result = await this.subscriptionSvcService.getPlanLimits(data.customerId, data.planId);
      return result;
    } catch (error) {
      debug.error('[gRPC GetPlanLimits] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetActiveSubscription')
  async getActiveSubscription(data: { customerId: string }) {
    try {
      debug.log(`[SubscriptionController] Getting active subscription for ${data.customerId}...`);
      const subscription = await this.subscriptionSvcService.getActiveSubscription(data.customerId);
      
      if (!subscription) {
        return { subscription: null, message: 'No active subscription found' };
      }

      return {
        subscription: {
          id: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          isTrialUsed: subscription.isTrialUsed,
          trialStart: subscription.trialStart?.toISOString() || '',
          trialEnd: subscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() || '',
          cancellationReason: subscription.cancellationReason || '',
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        },
        message: 'Active subscription found',
      };
    } catch (error) {
      debug.error('[gRPC GetActiveSubscription] Error:', error);
      throw error;
    }
  }

  // =================== WEBHOOK EVENT HANDLERS ===================
  // These are called from payment-svc when Stripe webhooks are received

  @GrpcMethod('SubscriptionService', 'HandlePaymentSucceeded')
  async handlePaymentSucceeded(data: {
    paymentId: string;
    customerId: string;
    orderId?: string;
    amount: number;
    stripePaymentIntentId?: string;
    subscriptionId?: string;
  }) {
    try {
      debug.log(`[SubscriptionController] Handling payment succeeded for ${data.customerId}...`);
      const result = await this.subscriptionSvcService.handlePaymentSucceeded(data);
      return result;
    } catch (error) {
      debug.error('[gRPC HandlePaymentSucceeded] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  @GrpcMethod('SubscriptionService', 'HandleSubscriptionUpdated')
  async handleSubscriptionUpdated(data: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      debug.log(`[SubscriptionController] Handling Stripe subscription updated: ${data.stripeSubscriptionId}...`);
      const result = await this.subscriptionSvcService.handleStripeSubscriptionUpdated(data);
      return result;
    } catch (error) {
      debug.error('[gRPC HandleSubscriptionUpdated] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  @GrpcMethod('SubscriptionService', 'HandleSubscriptionDeleted')
  async handleSubscriptionDeleted(data: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    canceledAt?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      debug.log(`[SubscriptionController] Handling Stripe subscription deleted: ${data.stripeSubscriptionId}...`);
      const result = await this.subscriptionSvcService.handleStripeSubscriptionDeleted(data);
      return result;
    } catch (error) {
      debug.error('[gRPC HandleSubscriptionDeleted] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  @GrpcMethod('SubscriptionService', 'HandleInvoicePaid')
  async handleInvoicePaid(data: {
    stripeInvoiceId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    amountPaid: number;
    currency: string;
    paidAt: string;
  }) {
    try {
      debug.log(`[SubscriptionController] Handling invoice paid: ${data.stripeInvoiceId}...`);
      const result = await this.subscriptionSvcService.handleInvoicePaid(data);
      return result;
    } catch (error) {
      debug.error('[gRPC HandleInvoicePaid] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
