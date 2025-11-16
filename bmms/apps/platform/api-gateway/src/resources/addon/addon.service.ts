import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface IAddonGrpcService {
  listAddons(data: any): any;
  getAddonByKey(data: any): any;
  createAddon(data: any): any;
  purchaseAddons(data: any): any;
  getUserAddons(data: any): any;
  cancelAddon(data: any): any;
}

@Injectable()
export class AddonService implements OnModuleInit {
  private readonly logger = new Logger(AddonService.name);
  private addonService: IAddonGrpcService;

  constructor(
    @Inject('SUBSCRIPTION_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.addonService = this.client.getService<IAddonGrpcService>('SubscriptionService');
    this.logger.log('✅ AddonService gRPC client initialized');
  }

  /**
   * List all available add-ons
   */
  async listAddons() {
    try {
      const result: any = await firstValueFrom(this.addonService.listAddons({}));
      return result.addons || [];
    } catch (error) {
      this.logger.error(`Failed to list add-ons: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get add-on by key
   */
  async getAddon(key: string) {
    try {
      const result: any = await firstValueFrom(this.addonService.getAddonByKey({ key }));
      return result.addon;
    } catch (error) {
      this.logger.error(`Failed to get add-on ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new add-on (Admin only)
   */
  async createAddon(data: {
    addonKey: string;
    name: string;
    description?: string;
    price: number;
    billingPeriod: 'monthly' | 'yearly' | 'onetime';
    features?: Record<string, any>;
  }) {
    try {
      const result: any = await firstValueFrom(
        this.addonService.createAddon({
          ...data,
          features: data.features ? JSON.stringify(data.features) : '{}',
        }),
      );
      return result.addon;
    } catch (error) {
      this.logger.error(`Failed to create add-on: ${error.message}`);
      throw error;
    }
  }

  /**
   * Purchase add-ons
   */
  async purchaseAddons(data: {
    subscriptionId: number;
    customerId: number;
    addonKeys: string[];
  }) {
    try {
      const result: any = await firstValueFrom(
        this.addonService.purchaseAddons(data),
      );
      return result.userAddons || [];
    } catch (error) {
      this.logger.error(`Failed to purchase add-ons: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's active add-ons
   */
  async getUserAddons(subscriptionId: number) {
    try {
      const result: any = await firstValueFrom(
        this.addonService.getUserAddons({ subscriptionId }),
      );
      return result.userAddons || [];
    } catch (error) {
      this.logger.error(
        `Failed to get user add-ons for subscription ${subscriptionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Cancel add-on
   */
  async cancelAddon(id: number) {
    try {
      const result: any = await firstValueFrom(
        this.addonService.cancelAddon({ id }),
      );
      return result.userAddon;
    } catch (error) {
      this.logger.error(`Failed to cancel add-on ${id}: ${error.message}`);
      throw error;
    }
  }
}
