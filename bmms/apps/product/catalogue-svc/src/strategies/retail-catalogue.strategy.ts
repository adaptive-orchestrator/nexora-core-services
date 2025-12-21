import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ICatalogueStrategy,
  CatalogueQueryParams,
  CatalogueDisplayResult,
} from './catalogue-strategy.interface';
import { Product } from '../catalogue.entity';

/**
 * Strategy 1: Retail Catalogue (One-time Purchase Products)
 * 
 * Characteristics:
 * - Display physical/digital products
 * - One-time purchase pricing
 * - SKU-based inventory
 * - No recurring billing
 */
@Injectable()
export class RetailCatalogueStrategy implements ICatalogueStrategy {
  private readonly logger = new Logger(RetailCatalogueStrategy.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  canHandle(businessModel: string): boolean {
    return businessModel === 'retail' || businessModel === 'onetime';
  }

  getStrategyName(): string {
    return 'RetailCatalogueStrategy';
  }

  async getDisplayItems(params: CatalogueQueryParams): Promise<CatalogueDisplayResult> {
    this.logger.log(`[Catalogue] Getting RETAIL catalogue items`);

    const query = this.productRepo.createQueryBuilder('product');

    // Filter by price range
    if (params.priceRange?.min !== undefined) {
      query.andWhere('product.price >= :minPrice', { minPrice: params.priceRange.min });
    }
    if (params.priceRange?.max !== undefined) {
      query.andWhere('product.price <= :maxPrice', { maxPrice: params.priceRange.max });
    }

    // Only show in-stock products (optional filter)
    // Note: Product entity doesn't have isActive field by default

    // Apply pagination
    if (params.limit) {
      query.take(params.limit);
    }
    if (params.offset) {
      query.skip(params.offset);
    }

    query.orderBy('product.createdAt', 'DESC');

    const [items, total] = await query.getManyAndCount();

    this.logger.log(`[Catalogue] Found ${total} retail products`);

    return {
      items,
      total,
      displayMode: 'products',
      metadata: {
        catalogueType: 'retail',
      },
    };
  }

  filterItems(items: Product[], params: any): Product[] {
    return items.filter(product => {
      // Filter by price range
      if (params.priceRange?.min && product.price < params.priceRange.min) {
        return false;
      }
      if (params.priceRange?.max && product.price > params.priceRange.max) {
        return false;
      }

      return true;
    });
  }
}
