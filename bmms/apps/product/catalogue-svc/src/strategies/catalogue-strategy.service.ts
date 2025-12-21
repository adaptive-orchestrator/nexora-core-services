import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ICatalogueStrategy,
  CatalogueQueryParams,
  CatalogueDisplayResult,
} from './catalogue-strategy.interface';
import { RetailCatalogueStrategy } from './retail-catalogue.strategy';
import { SubscriptionCatalogueStrategy } from './subscription-catalogue.strategy';
import { FreemiumCatalogueStrategy } from './freemium-catalogue.strategy';

/**
 * Catalogue Strategy Factory
 * 
 * Automatically selects the correct catalogue display strategy based on:
 * 1. Query params (businessModel field)
 * 2. ENV var CATALOGUE_MODE
 * 3. Fallback to default (retail)
 */
@Injectable()
export class CatalogueStrategyService {
  private readonly logger = new Logger(CatalogueStrategyService.name);
  private strategies: ICatalogueStrategy[];
  private defaultStrategy: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly retailStrategy: RetailCatalogueStrategy,
    private readonly subscriptionStrategy: SubscriptionCatalogueStrategy,
    private readonly freemiumStrategy: FreemiumCatalogueStrategy,
  ) {
    // Register all strategies
    this.strategies = [
      this.retailStrategy,
      this.subscriptionStrategy,
      this.freemiumStrategy,
    ];

    // Get default from ENV (for dev mode)
    this.defaultStrategy = this.configService.get<string>('CATALOGUE_MODE', 'retail');
    
    this.logger.log(`[Catalogue] CatalogueStrategyService initialized`);
    this.logger.log(`   Default mode: ${this.defaultStrategy}`);
    this.logger.log(`   Available strategies: ${this.strategies.length}`);
  }

  /**
   * Get the appropriate strategy for given params
   */
  getStrategy(params: CatalogueQueryParams): ICatalogueStrategy {
    // Priority 1: Use businessModel from params
    const businessModel = params.businessModel;
    
    if (businessModel) {
      const strategy = this.strategies.find(s => s.canHandle(businessModel));
      if (strategy) {
        this.logger.log(`[Catalogue] Selected strategy: ${strategy.getStrategyName()} (from params)`);
        return strategy;
      }
    }

    // Priority 2: Use ENV var (for dev mode)
    const envStrategy = this.strategies.find(s => s.canHandle(this.defaultStrategy));
    if (envStrategy) {
      this.logger.log(`[Catalogue] Selected strategy: ${envStrategy.getStrategyName()} (from ENV)`);
      return envStrategy;
    }

    // Fallback: Use first strategy (retail)
    this.logger.warn(`[WARNING] No matching strategy found, using default: ${this.strategies[0].getStrategyName()}`);
    return this.strategies[0];
  }

  /**
   * Get catalogue items using appropriate strategy
   */
  async getItemsByModel(params: CatalogueQueryParams): Promise<CatalogueDisplayResult> {
    const strategy = this.getStrategy(params);
    
    this.logger.log(`[Catalogue] Getting catalogue items using ${strategy.getStrategyName()}`);
    
    try {
      return await strategy.getDisplayItems(params);
    } catch (error) {
      this.logger.error(`[ERROR] Failed to get catalogue items: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all available strategies (for debugging)
   */
  listStrategies(): string[] {
    return this.strategies.map(s => s.getStrategyName());
  }
}
