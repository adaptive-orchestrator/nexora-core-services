import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AddonService } from './addon.service';

@Controller()
export class AddonGrpcController {
  constructor(private readonly addonService: AddonService) {}

  @GrpcMethod('SubscriptionService', 'ListAddons')
  async listAddons() {
    const addons = await this.addonService.listAddons();
    return {
      addons: addons.map((addon) => ({
        ...addon,
        features: addon.features ? JSON.stringify(addon.features) : '{}',
      })),
      message: 'Addons retrieved successfully',
    };
  }

  @GrpcMethod('SubscriptionService', 'GetAddonByKey')
  async getAddonByKey(data: { key: string }) {
    const addon = await this.addonService.getAddonByKey(data.key);
    return {
      addon: {
        ...addon,
        features: addon.features ? JSON.stringify(addon.features) : '{}',
      },
      message: 'Addon retrieved successfully',
    };
  }

  @GrpcMethod('SubscriptionService', 'CreateAddon')
  async createAddon(data: {
    addonKey: string;
    name: string;
    description?: string;
    price: number;
    billingPeriod: string;
    features?: string;
  }) {
    const addon = await this.addonService.createAddon({
      addonKey: data.addonKey,
      name: data.name,
      description: data.description,
      price: data.price,
      billingPeriod: data.billingPeriod as 'monthly' | 'yearly' | 'onetime',
      features: data.features ? JSON.parse(data.features) : undefined,
    });
    return {
      addon: {
        ...addon,
        features: addon.features ? JSON.stringify(addon.features) : '{}',
      },
      message: 'Addon created successfully',
    };
  }

  @GrpcMethod('SubscriptionService', 'PurchaseAddons')
  async purchaseAddons(data: {
    subscriptionId: number;
    customerId: number;
    addonKeys: string[];
  }) {
    const userAddons = await this.addonService.purchaseAddons(
      data.subscriptionId,
      data.customerId,
      data.addonKeys,
    );
    return {
      userAddons,
      message: 'Addons purchased successfully',
    };
  }

  @GrpcMethod('SubscriptionService', 'GetUserAddons')
  async getUserAddons(data: { subscriptionId: number }) {
    const userAddons = await this.addonService.getUserAddons(
      data.subscriptionId,
    );
    return {
      userAddons,
      message: 'User addons retrieved successfully',
    };
  }

  @GrpcMethod('SubscriptionService', 'CancelAddon')
  async cancelAddon(data: { id: number }) {
    const userAddon = await this.addonService.cancelAddon(data.id);
    return {
      userAddon,
      message: 'Addon cancelled successfully',
    };
  }
}
