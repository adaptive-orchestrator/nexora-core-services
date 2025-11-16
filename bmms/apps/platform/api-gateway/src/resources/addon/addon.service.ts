import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AddonService {
  private readonly logger = new Logger(AddonService.name);
  private readonly subscriptionSvcUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.subscriptionSvcUrl =
      this.configService.get<string>('SUBSCRIPTION_SVC_URL') ||
      'http://localhost:3006';
  }

  /**
   * List all available add-ons
   */
  async listAddons() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.subscriptionSvcUrl}/addons`),
      );
      return response.data;
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
      const response = await firstValueFrom(
        this.httpService.get(`${this.subscriptionSvcUrl}/addons/${key}`),
      );
      return response.data;
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
      const response = await firstValueFrom(
        this.httpService.post(`${this.subscriptionSvcUrl}/addons`, data),
      );
      return response.data;
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
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.subscriptionSvcUrl}/addons/purchase`,
          data,
        ),
      );
      return response.data;
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
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.subscriptionSvcUrl}/addons/user/${subscriptionId}`,
        ),
      );
      return response.data;
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
      const response = await firstValueFrom(
        this.httpService.delete(`${this.subscriptionSvcUrl}/addons/user/${id}`),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to cancel add-on ${id}: ${error.message}`);
      throw error;
    }
  }
}
