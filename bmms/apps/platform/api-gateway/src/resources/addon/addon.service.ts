import { Injectable, Logger, Inject, OnModuleInit, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, retry, timer, throwError } from 'rxjs';
import { catchError, mergeMap, retryWhen, delayWhen, take, tap } from 'rxjs/operators';

interface IAddonGrpcService {
  listAddons(data: { page?: number; limit?: number }): any;
  getAddonByKey(data: any): any;
  createAddon(data: any): any;
  purchaseAddons(data: any): any;
  getUserAddons(data: { subscriptionId: number; page?: number; limit?: number }): any;
  cancelAddon(data: any): any;
}

// Retry configuration (optimized for speed)
const RETRY_CONFIG = {
  maxRetries: 2,      // Reduced from 3
  initialDelay: 50,   // Reduced from 100ms
  maxDelay: 500,      // Reduced from 2000ms
  backoffMultiplier: 2,
};

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
    this.logger.log('[OK] AddonService gRPC client initialized');
  }

  /**
   * Retry with exponential backoff helper
   */
  private async withRetry<T>(operation: () => any, operationName: string): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await firstValueFrom(operation());
      } catch (error) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
          break;
        }
        
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        
        this.logger.warn(`${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}), retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    // Retry on UNAVAILABLE (14), DEADLINE_EXCEEDED (4), RESOURCE_EXHAUSTED (8)
    const retryableCodes = [4, 8, 14];
    return retryableCodes.includes(error.code) || 
           error.message?.includes('UNAVAILABLE') ||
           error.message?.includes('timeout') ||
           error.message?.includes('connection');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * List all available add-ons with pagination
   */
  async listAddons(page: number = 1, limit: number = 20) {
    try {
      const result: any = await this.withRetry(
        () => this.addonService.listAddons({ page, limit }),
        'listAddons'
      );
      return {
        addons: result.addons || [],
        total: result.total || 0,
        page: result.page || page,
        limit: result.limit || limit,
        totalPages: result.totalPages || 0,
      };
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
      const result: any = await this.withRetry(
        () => this.addonService.getAddonByKey({ key }),
        `getAddon(${key})`
      );
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
      const result: any = await this.withRetry(
        () => this.addonService.createAddon({
          ...data,
          features: data.features ? JSON.stringify(data.features) : '{}',
        }),
        'createAddon'
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
      const result: any = await this.withRetry(
        () => this.addonService.purchaseAddons(data),
        'purchaseAddons'
      );
      return result.userAddons || [];
    } catch (error) {
      this.logger.error(`Failed to purchase add-ons: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's active add-ons with pagination
   */
  async getUserAddons(subscriptionId: number, page: number = 1, limit: number = 20) {
    try {
      const result: any = await this.withRetry(
        () => this.addonService.getUserAddons({ subscriptionId, page, limit }),
        `getUserAddons(${subscriptionId})`
      );
      return {
        userAddons: result.userAddons || [],
        total: result.total || 0,
        page: result.page || page,
        limit: result.limit || limit,
        totalPages: result.totalPages || 0,
      };
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
      const result: any = await this.withRetry(
        () => this.addonService.cancelAddon({ id }),
        `cancelAddon(${id})`
      );
      return result.userAddon;
    } catch (error) {
      this.logger.error(`Failed to cancel add-on ${id}: ${error.message}`);
      
      // Handle gRPC NOT_FOUND error
      if (error.code === 5 || error.details?.includes('not found')) {
        throw new NotFoundException(`User add-on ${id} not found`);
      }
      
      throw new HttpException(
        error.details || error.message || 'Failed to cancel add-on',
        error.code === 3 ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
