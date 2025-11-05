import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ICatalogueStrategy,
  CatalogueQueryParams,
  CatalogueDisplayResult,
} from './catalogue-strategy.interface';
import { Plan } from '../catalogue.entity';

/**
 * Strategy 2: Subscription Catalogue (Recurring Payment Plans)
 * 
 * Characteristics:
 * - Display subscription plans
 * - Monthly/Yearly billing cycles
 * - Trial periods
 * - Plan tiers (Basic, Pro, Enterprise)
 */
@Injectable()
export class SubscriptionCatalogueStrategy implements ICatalogueStrategy {
  private readonly logger = new Logger(SubscriptionCatalogueStrategy.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  canHandle(businessModel: string): boolean {
    return businessModel === 'subscription' || businessModel === 'recurring';
  }

  getStrategyName(): string {
    return 'SubscriptionCatalogueStrategy';
  }

  async getDisplayItems(params: CatalogueQueryParams): Promise<CatalogueDisplayResult> {
    this.logger.log(`📋 Getting SUBSCRIPTION catalogue items`);

    const query = this.planRepo.createQueryBuilder('plan');

    // Filter by price range
    if (params.priceRange?.min !== undefined) {
      query.andWhere('plan.price >= :minPrice', { minPrice: params.priceRange.min });
    }
    if (params.priceRange?.max !== undefined) {
      query.andWhere('plan.price <= :maxPrice', { maxPrice: params.priceRange.max });
    }

    // Apply pagination
    if (params.limit) {
      query.take(params.limit);
    }
    if (params.offset) {
      query.skip(params.offset);
    }

    // Order by price (ascending) for plan tiers
    query.orderBy('plan.price', 'ASC');

    const [items, total] = await query.getManyAndCount();

    this.logger.log(`✅ Found ${total} subscription plans`);

    return {
      items,
      total,
      displayMode: 'plans',
      metadata: {
        catalogueType: 'subscription',
      },
    };
  }

  filterItems(items: Plan[], params: any): Plan[] {
    return items.filter(plan => {
      // Filter by price range
      if (params.priceRange?.min && plan.price < params.priceRange.min) {
        return false;
      }
      if (params.priceRange?.max && plan.price > params.priceRange.max) {
        return false;
      }

      // Filter by billing cycle if specified
      if (params.billingCycle && plan.billingCycle !== params.billingCycle) {
        return false;
      }

      // Filter by trial availability
      if (params.trialOnly && !plan.trialEnabled) {
        return false;
      }

      return true;
    });
  }
}
