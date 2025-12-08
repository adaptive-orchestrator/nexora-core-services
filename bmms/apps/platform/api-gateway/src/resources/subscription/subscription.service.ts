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
  }

  async createSubscription(dto: CreateSubscriptionDto) {
    try {
      const result = await firstValueFrom(this.subscriptionService.createSubscription(dto));
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getSubscriptionById(id: string) {
    try {
      return await firstValueFrom(this.subscriptionService.getSubscriptionById({ id }));
    } catch (error) {
      throw error;
    }
  }

  async getSubscriptionsByCustomer(customerId: string) {
    try {
      return await firstValueFrom(
        this.subscriptionService.getSubscriptionsByCustomer({ customerId })
      );
    } catch (error) {
      throw error;
    }
  }

  async cancelSubscription(id: string, dto: CancelSubscriptionDto) {
    try {
      const result = await firstValueFrom(
        this.subscriptionService.cancelSubscription({
          id,
          reason: dto.reason,
          cancelAtPeriodEnd: dto.cancelAtPeriodEnd || false,
        })
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  async renewSubscription(id: string) {
    try {
      const result = await firstValueFrom(this.subscriptionService.renewSubscription({ id }));
      return result;
    } catch (error) {
      throw error;
    }
  }

  async changePlan(id: string, dto: ChangePlanDto) {
    try {
      const result = await firstValueFrom(
        this.subscriptionService.changePlan({
          id,
          newPlanId: dto.newPlanId,
          immediate: dto.immediate || false,
        })
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  async updateSubscriptionStatus(id: string, newStatus: string, reason?: string) {
    try {
      return await firstValueFrom(
        this.subscriptionService.updateSubscriptionStatus({
          id,
          newStatus,
          reason: reason || '',
        })
      );
    } catch (error) {
      throw error;
    }
  }

  async getAllSubscriptions() {
    try {
      return await firstValueFrom(
        this.subscriptionService.getAllSubscriptions({})
      );
    } catch (error) {
      throw error;
    }
  }

  async checkTrialExpiry() {
    try {
      const result = await firstValueFrom(
        this.subscriptionService.checkTrialExpiry({})
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  async activateSubscription(subscriptionId: string) {
    try {
      const result = await firstValueFrom(
        this.subscriptionService.activateSubscription({ subscriptionId })
      );
      return result;
    } catch (error) {
      throw error;
    }
  }
}
