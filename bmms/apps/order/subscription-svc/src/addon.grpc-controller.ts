import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { AddonService } from './addon.service';

@Controller()
export class AddonGrpcController {
  private readonly logger = new Logger(AddonGrpcController.name);

  constructor(private readonly addonService: AddonService) {}

  @GrpcMethod('SubscriptionService', 'ListAddons')
  async listAddons(data: { page?: number; limit?: number }) {
    const page = data?.page || 1;
    const limit = data?.limit || 20;
    
    const result = await this.addonService.listAddons(page, limit);
    return {
      addons: result.addons.map((addon) => ({
        ...addon,
        features: addon.features ? JSON.stringify(addon.features) : '{}',
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
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
  async getUserAddons(data: { subscriptionId: number; page?: number; limit?: number }) {
    const page = data?.page || 1;
    const limit = data?.limit || 20;
    
    const result = await this.addonService.getUserAddons(
      data.subscriptionId,
      page,
      limit,
    );
    return {
      userAddons: result.userAddons,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      message: 'User addons retrieved successfully',
    };
  }

  @GrpcMethod('SubscriptionService', 'CancelAddon')
  async cancelAddon(data: { id: number }) {
    try {
      if (!data.id || data.id <= 0) {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid addon id',
        });
      }

      const userAddon = await this.addonService.cancelAddon(data.id);
      return {
        userAddon,
        message: 'Addon cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel addon ${data.id}: ${error.message}`);
      
      if (error.name === 'NotFoundException' || error.message?.includes('not found')) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: error.message || `User add-on ${data.id} not found`,
        });
      }
      
      throw new RpcException({
        code: status.INTERNAL,
        message: error.message || 'Failed to cancel addon',
      });
    }
  }
}
