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
 * Strategy 3: Freemium Catalogue (Free Plans + Add-ons)
 * 
 * Characteristics:
 * - Display FREE base plan
 * - Display available add-ons for purchase
 * - Upsell opportunities to paid plans
 * - Feature comparison
 */
@Injectable()
export class FreemiumCatalogueStrategy implements ICatalogueStrategy {
  private readonly logger = new Logger(FreemiumCatalogueStrategy.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  canHandle(businessModel: string): boolean {
    return businessModel === 'freemium' || businessModel === 'freemium_addon';
  }

  getStrategyName(): string {
    return 'FreemiumCatalogueStrategy';
  }

  async getDisplayItems(params: CatalogueQueryParams): Promise<CatalogueDisplayResult> {
    this.logger.log(`💎 Getting FREEMIUM catalogue items`);

    // Get free plan (price = 0)
    const freePlanQuery = this.planRepo.createQueryBuilder('plan')
      .where('plan.price = :price', { price: 0 })
      .orWhere('plan.name LIKE :freeName', { freeName: '%Free%' });

    const freePlans = await freePlanQuery.getMany();

    // Get available add-ons (this would ideally come from addon table)
    // For now, we'll get low-priced plans as "upgradeable" options
    const addonQuery = this.planRepo.createQueryBuilder('plan')
      .where('plan.price > :minPrice', { minPrice: 0 })
      .andWhere('plan.price < :maxPrice', { maxPrice: 200000 }) // Add-on range
      .orderBy('plan.price', 'ASC')
      .take(params.limit || 10);

    const addons = await addonQuery.getMany();

    // Combine free plans + addons
    const items = [...freePlans, ...addons];

    this.logger.log(`✅ Found ${freePlans.length} free plans + ${addons.length} add-ons`);

    return {
      items,
      total: items.length,
      displayMode: 'freemium',
      metadata: {
        catalogueType: 'freemium',
        hasFreeTier: freePlans.length > 0,
        hasAddons: addons.length > 0,
      },
    };
  }

  filterItems(items: Plan[], params: any): Plan[] {
    return items.filter(plan => {
      // Filter free plans
      if (params.freeTierOnly && plan.price !== 0) {
        return false;
      }

      // Filter add-ons (price > 0 but < threshold)
      if (params.addonsOnly && (plan.price === 0 || plan.price > 200000)) {
        return false;
      }

      return true;
    });
  }
}
