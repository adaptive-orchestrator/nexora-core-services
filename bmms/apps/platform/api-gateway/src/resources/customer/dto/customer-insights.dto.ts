import { ApiProperty } from '@nestjs/swagger';

export class CustomerInsightsDto {
  @ApiProperty({
    example: {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      currentSegment: 'gold',
      currentLifecycleStage: 'loyal',
    },
  })
  customer: {
    id: number;
    name: string;
    email: string;
    currentSegment: string;
    currentLifecycleStage: string;
  };

  @ApiProperty({
    example: {
      calculatedSegment: 'gold',
      segmentBenefits: [
        'Premium support 24/7',
        '10% discount on all orders',
        'Free shipping',
        'Exclusive promotions',
      ],
      lifecycleStage: 'loyal',
      isAtRiskOfChurning: false,
      estimatedLifetimeValue: 15750.0,
      recommendedActions: [
        'Upgrade to premium segment',
        'Invite to VIP program',
        'Send exclusive offers',
      ],
    },
  })
  insights: {
    calculatedSegment: string;
    segmentBenefits: string[];
    lifecycleStage: string;
    isAtRiskOfChurning: boolean;
    estimatedLifetimeValue: number;
    recommendedActions: string[];
  };

  @ApiProperty({
    example: {
      totalSpent: 7500.0,
      orderCount: 12,
      lastOrderDate: '2025-10-20T10:30:00Z',
      daysSinceFirstOrder: 180,
      avgOrderValue: 625.0,
    },
  })
  metrics: {
    totalSpent: number;
    orderCount: number;
    lastOrderDate: string | null;
    daysSinceFirstOrder: number;
    avgOrderValue: number;
  };
}

export class SegmentCalculationDto {
  @ApiProperty({ example: 'gold' })
  segment: string;

  @ApiProperty({
    example: [
      'Premium support 24/7',
      '10% discount on all orders',
      'Free shipping',
      'Exclusive promotions',
    ],
  })
  benefits: string[];

  @ApiProperty({
    example: {
      bronze: { min: 0, max: 999 },
      silver: { min: 1000, max: 4999 },
      gold: { min: 5000, max: 19999 },
      platinum: { min: 20000, max: null },
    },
  })
  thresholds: Record<string, { min: number; max: number | null }>;
}
