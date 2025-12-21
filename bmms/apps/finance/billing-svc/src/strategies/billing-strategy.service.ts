import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IBillingStrategy,
  BillingCalculationParams,
  BillingResult,
} from './billing-strategy.interface';
import { OnetimeBillingStrategy } from './onetime-billing.strategy';
import { RecurringBillingStrategy } from './recurring-billing.strategy';
import { FreemiumBillingStrategy } from './freemium-billing.strategy';

/**
 * Billing Strategy Factory
 * 
 * Automatically selects the correct billing strategy based on:
 * 1. ENV vars (BILLING_MODE)
 * 2. Order/Subscription metadata (businessModel field)
 * 3. Fallback to default
 */
@Injectable()
export class BillingStrategyService {
  private readonly logger = new Logger(BillingStrategyService.name);
  private strategies: IBillingStrategy[];
  private defaultStrategy: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly onetimeStrategy: OnetimeBillingStrategy,
    private readonly recurringStrategy: RecurringBillingStrategy,
    private readonly freemiumStrategy: FreemiumBillingStrategy,
  ) {
    // Register all strategies
    this.strategies = [
      this.onetimeStrategy,
      this.recurringStrategy,
      this.freemiumStrategy,
    ];

    // Get default from ENV (for dev mode)
    this.defaultStrategy = this.configService.get<string>('BILLING_MODE', 'onetime');
    
    this.logger.log(`[Billing] BillingStrategyService initialized`);
    this.logger.log(`   Default mode: ${this.defaultStrategy}`);
    this.logger.log(`   Available strategies: ${this.strategies.length}`);
  }

  /**
   * Get the appropriate strategy for given params
   */
  getStrategy(params: BillingCalculationParams): IBillingStrategy {
    // Priority 1: Use businessModel from metadata
    const businessModel = params.metadata?.businessModel;
    
    if (businessModel) {
      const strategy = this.strategies.find(s => s.canHandle(businessModel));
      if (strategy) {
        this.logger.log(`[Billing] Selected strategy: ${strategy.getStrategyName()} (from metadata)`);
        return strategy;
      }
    }

    // Priority 2: Use ENV var (for dev mode)
    const envStrategy = this.strategies.find(s => s.canHandle(this.defaultStrategy));
    if (envStrategy) {
      this.logger.log(`[Billing] Selected strategy: ${envStrategy.getStrategyName()} (from ENV)`);
      return envStrategy;
    }

    // Fallback: Use first strategy (onetime)
    this.logger.warn(`[WARNING] No matching strategy found, using default: ${this.strategies[0].getStrategyName()}`);
    return this.strategies[0];
  }

  /**
   * Calculate billing amount using appropriate strategy
   */
  async calculate(params: BillingCalculationParams): Promise<BillingResult> {
    const strategy = this.getStrategy(params);
    
    this.logger.log(`[Billing] Calculating billing using ${strategy.getStrategyName()}`);
    
    try {
      return await strategy.calculateAmount(params);
    } catch (error) {
      this.logger.error(`[ERROR] Billing calculation failed: ${error.message}`);
      throw new BadRequestException(`Failed to calculate billing: ${error.message}`);
    }
  }

  /**
   * List all available strategies (for debugging)
   */
  listStrategies(): string[] {
    return this.strategies.map(s => s.getStrategyName());
  }
}
