import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';

interface ISubscriptionGrpcService {
  createSubscription(data: any): any;
  getSubscriptionById(data: any): any;
  getSubscriptionsByCustomer(data: any): any;
  getAllSubscriptions(data: any): any;
  cancelSubscription(data: any): any;
  renewSubscription(data: any): any;
  changePlan(data: any): any;
  updateSubscriptionStatus(data: any): any;
  checkTrialExpiry(data: any): any;
  activateSubscription(data: any): any;
}

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private subscriptionService: ISubscriptionGrpcService;

  constructor(
    @Inject('SUBSCRIPTION_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.subscriptionService = this.client.getService<ISubscriptionGrpcService>('SubscriptionService');
    console.log('✅ [API Gateway] SubscriptionService gRPC client initialized');
  }

  async createSubscription(dto: CreateSubscriptionDto) {
    try {
      console.log('🔵 [API Gateway] Creating subscription:', dto);
      const result = await firstValueFrom(this.subscriptionService.createSubscription(dto));
      console.log('✅ [API Gateway] Subscription created successfully');
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error creating subscription:', error);
      throw error;
    }
  }

  async getSubscriptionById(id: number) {
    try {
      return await firstValueFrom(this.subscriptionService.getSubscriptionById({ id }));
    } catch (error) {
      console.error('❌ [API Gateway] Error getting subscription:', error);
      throw error;
    }
  }

  async getSubscriptionsByCustomer(customerId: number) {
    try {
      return await firstValueFrom(
        this.subscriptionService.getSubscriptionsByCustomer({ customerId })
      );
    } catch (error) {
      console.error('❌ [API Gateway] Error getting customer subscriptions:', error);
      throw error;
    }
  }

  async cancelSubscription(id: number, dto: CancelSubscriptionDto) {
    try {
      console.log('🔵 [API Gateway] Cancelling subscription:', id, dto);
      const result = await firstValueFrom(
        this.subscriptionService.cancelSubscription({
          id,
          reason: dto.reason,
          cancelAtPeriodEnd: dto.cancelAtPeriodEnd || false,
        })
      );
      console.log('✅ [API Gateway] Subscription cancelled successfully');
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error cancelling subscription:', error);
      throw error;
    }
  }

  async renewSubscription(id: number) {
    try {
      console.log('🔵 [API Gateway] Renewing subscription:', id);
      const result = await firstValueFrom(this.subscriptionService.renewSubscription({ id }));
      console.log('✅ [API Gateway] Subscription renewed successfully');
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error renewing subscription:', error);
      throw error;
    }
  }

  async changePlan(id: number, dto: ChangePlanDto) {
    try {
      console.log('🔵 [API Gateway] Changing plan for subscription:', id, dto);
      const result = await firstValueFrom(
        this.subscriptionService.changePlan({
          id,
          newPlanId: dto.newPlanId,
          immediate: dto.immediate || false,
        })
      );
      console.log('✅ [API Gateway] Plan changed successfully');
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error changing plan:', error);
      throw error;
    }
  }

  async updateSubscriptionStatus(id: number, newStatus: string, reason?: string) {
    try {
      return await firstValueFrom(
        this.subscriptionService.updateSubscriptionStatus({
          id,
          newStatus,
          reason: reason || '',
        })
      );
    } catch (error) {
      console.error('❌ [API Gateway] Error updating subscription status:', error);
      throw error;
    }
  }

  async getAllSubscriptions() {
    try {
      return await firstValueFrom(
        this.subscriptionService.getAllSubscriptions({})
      );
    } catch (error) {
      console.error('❌ [API Gateway] Error getting all subscriptions:', error);
      throw error;
    }
  }

  async checkTrialExpiry() {
    try {
      console.log('🔍 [API Gateway] Manually triggering trial expiry check...');
      const result = await firstValueFrom(
        this.subscriptionService.checkTrialExpiry({})
      );
      console.log('✅ [API Gateway] Trial expiry check completed');
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error checking trial expiry:', error);
      throw error;
    }
  }

  async activateSubscription(subscriptionId: number) {
    try {
      console.log(`🔄 [API Gateway] Activating subscription ${subscriptionId}...`);
      const result = await firstValueFrom(
        this.subscriptionService.activateSubscription({ subscriptionId })
      );
      console.log(`✅ [API Gateway] Subscription ${subscriptionId} activated`);
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error activating subscription:', error);
      throw error;
    }
  }
}
