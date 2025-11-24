import { ApiProperty } from '@nestjs/swagger';

export class RetailStatsDto {
  @ApiProperty({ description: 'Total retail revenue', example: 25430.00 })
  revenue: number;

  @ApiProperty({ description: 'Number of orders', example: 1847 })
  orders: number;

  @ApiProperty({ description: 'Number of customers', example: 2245 })
  customers: number;

  @ApiProperty({ description: 'Average order value', example: 13.77 })
  avgOrderValue: number;
}

export class SubscriptionStatsDto {
  @ApiProperty({ description: 'Monthly recurring revenue', example: 12480.00 })
  mrr: number;

  @ApiProperty({ description: 'Number of active subscriptions', example: 249 })
  activeSubscriptions: number;

  @ApiProperty({ description: 'Churn rate percentage', example: 2.3 })
  churnRate: number;

  @ApiProperty({ description: 'Lifetime value', example: 598.40 })
  ltv: number;
}

export class FreemiumStatsDto {
  @ApiProperty({ description: 'Number of free users', example: 3580 })
  freeUsers: number;

  @ApiProperty({ description: 'Number of paid add-ons', example: 342 })
  paidAddOns: number;

  @ApiProperty({ description: 'Conversion rate percentage', example: 9.6 })
  conversionRate: number;

  @ApiProperty({ description: 'Add-on revenue', example: 7321.89 })
  addOnRevenue: number;
}

export class OverallStatDto {
  @ApiProperty({ description: 'Stat title', example: 'Total Revenue' })
  title: string;

  @ApiProperty({ description: 'Stat value', example: '$45,231.89' })
  value: string;

  @ApiProperty({ description: 'Change percentage', example: '+20.1%' })
  change: string;

  @ApiProperty({ description: 'Icon name', example: 'DollarSign' })
  icon: string;

  @ApiProperty({ description: 'Description', example: 'Retail + Subscription + Add-ons' })
  description: string;
}

export class AdminDashboardStatsDto {
  @ApiProperty({ description: 'Retail business model statistics', type: RetailStatsDto })
  retail: RetailStatsDto;

  @ApiProperty({ description: 'Subscription business model statistics', type: SubscriptionStatsDto })
  subscription: SubscriptionStatsDto;

  @ApiProperty({ description: 'Freemium business model statistics', type: FreemiumStatsDto })
  freemium: FreemiumStatsDto;

  @ApiProperty({ description: 'Overall statistics', type: [OverallStatDto] })
  overall: OverallStatDto[];

  @ApiProperty({ description: 'Total revenue across all models', example: 45231.89 })
  totalRevenue: number;
}
