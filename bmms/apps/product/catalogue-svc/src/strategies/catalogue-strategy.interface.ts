/**
 * Catalogue Strategy Interface
 * 
 * Defines how catalogue items are displayed based on business model:
 * - Retail: Show products for one-time purchase
 * - Subscription: Show subscription plans
 * - Freemium: Show free plans + add-ons
 */

import { Product, Plan } from '../catalogue.entity';

export interface ICatalogueStrategy {
  /**
   * Get items to display for this business model
   */
  getDisplayItems(params: CatalogueQueryParams): Promise<CatalogueDisplayResult>;

  /**
   * Filter items based on model-specific rules
   */
  filterItems(items: Array<Product | Plan>, params: any): Array<Product | Plan>;

  /**
   * Check if this strategy can handle the business model
   */
  canHandle(businessModel: string): boolean;

  /**
   * Get strategy name for logging
   */
  getStrategyName(): string;
}

export interface CatalogueQueryParams {
  businessModel?: string;
  includeInactive?: boolean;
  priceRange?: {
    min?: number;
    max?: number;
  };
  limit?: number;
  offset?: number;
}

export interface CatalogueDisplayResult {
  items: Array<Product | Plan | any>;
  total: number;
  displayMode: 'products' | 'plans' | 'freemium' | 'multi';
  metadata?: {
    hasFreeTier?: boolean;
    hasAddons?: boolean;
    catalogueType?: string;
  };
}
