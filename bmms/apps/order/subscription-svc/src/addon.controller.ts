import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { AddonService } from './addon.service';
import { Addon } from './entities/addon.entity';
import { UserAddon } from './entities/user-addon.entity';

@Controller('addons')
export class AddonController {
  constructor(private readonly addonService: AddonService) {}

  /**
   * GET /addons
   * List all available add-ons
   */
  @Get()
  async listAddons(): Promise<Addon[]> {
    return this.addonService.listAddons();
  }

  /**
   * GET /addons/:key
   * Get add-on details by key
   */
  @Get(':key')
  async getAddon(@Param('key') key: string): Promise<Addon> {
    return this.addonService.getAddonByKey(key);
  }

  /**
   * POST /addons
   * Create new add-on (Admin only)
   */
  @Post()
  async createAddon(@Body() data: {
    addonKey: string;
    name: string;
    description?: string;
    price: number;
    billingPeriod: 'monthly' | 'yearly' | 'onetime';
    features?: Record<string, any>;
  }): Promise<Addon> {
    return this.addonService.createAddon(data);
  }

  /**
   * POST /addons/purchase
   * Purchase add-ons for a subscription
   */
  @Post('purchase')
  async purchaseAddons(@Body() data: {
    subscriptionId: number;
    customerId: number;
    addonKeys: string[];
  }): Promise<UserAddon[]> {
    return this.addonService.purchaseAddons(
      data.subscriptionId,
      data.customerId,
      data.addonKeys,
    );
  }

  /**
   * GET /addons/user/:subscriptionId
   * Get user's active add-ons
   */
  @Get('user/:subscriptionId')
  async getUserAddons(@Param('subscriptionId') subscriptionId: number): Promise<UserAddon[]> {
    return this.addonService.getUserAddons(subscriptionId);
  }

  /**
   * DELETE /addons/user/:id
   * Cancel add-on
   */
  @Delete('user/:id')
  async cancelAddon(@Param('id') id: number): Promise<UserAddon> {
    return this.addonService.cancelAddon(id);
  }
}
