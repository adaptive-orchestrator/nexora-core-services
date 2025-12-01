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
        planId: data.planId,
        promotionCode: data.promotionCode,
        useTrial: data.useTrial,
      };

      const subscription = await this.subscriptionSvcService.create(dto);

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
        message: 'Subscription created successfully',
      };
    } catch (error) {
      debug.error('❌ [gRPC CreateSubscription] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionById')
  async getSubscriptionById(data: { id: number }) {
    try {
      const subscription = await this.subscriptionSvcService.findById(data.id);

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
        message: 'Subscription found',
      };
    } catch (error) {
      console.error('❌ [gRPC GetSubscriptionById] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionsByCustomer')
  async getSubscriptionsByCustomer(data: { customerId: number }) {
    try {
      const subscriptions = await this.subscriptionSvcService.listByCustomer(data.customerId);

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
      };
    } catch (error) {
      console.error('❌ [gRPC GetSubscriptionsByCustomer] Error:', error);
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
      console.error('❌ [gRPC CancelSubscription] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'RenewSubscription')
  async renewSubscription(data: { id: number }) {
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
      console.error('❌ [gRPC RenewSubscription] Error:', error);
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
      console.error('❌ [gRPC ChangePlan] Error:', error);
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
      console.error('❌ [gRPC UpdateSubscriptionStatus] Error:', error);
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
      debug.error('❌ [gRPC GetAllSubscriptions] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'CheckTrialExpiry')
  async checkTrialExpiry() {
    try {
      debug.log('🔍 [SubscriptionController] Manual trigger: Checking trial expiry...');
      const result = await this.subscriptionSvcService.checkAndProcessTrialExpiry();
      
      return {
        processed: result.processed,
        converted: result.converted,
        failed: result.failed,
        message: `Processed ${result.processed} subscriptions. Converted: ${result.converted}, Failed: ${result.failed}`,
      };
    } catch (error) {
      debug.error('❌ [gRPC CheckTrialExpiry] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetSubscriptionStats')
  async getSubscriptionStats() {
    try {
      const stats = await this.subscriptionSvcService.getStats();
      return stats;
    } catch (error) {
      debug.error('❌ [gRPC GetSubscriptionStats] Error:', error);
      throw error;
    }
  }

  @GrpcMethod('SubscriptionService', 'ActivateSubscription')
  async activateSubscription(data: { subscriptionId: number }) {
    try {
      debug.log(`🔄 [SubscriptionController] Activating subscription ${data.subscriptionId}...`);
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
      debug.error('❌ [gRPC ActivateSubscription] Error:', error);
      throw error;
    }
  }
}
