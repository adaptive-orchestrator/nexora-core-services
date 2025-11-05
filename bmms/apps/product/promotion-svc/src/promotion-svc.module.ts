import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionSvcController } from './promotion-svc.controller';
import { PromotionSvcService } from './promotion-svc.service';
import { Promotion } from './entities/promotion.entity';
import { PromotionUsage } from './entities/promotion-usage.entity';
import { DbModule } from '@bmms/db';
import { EventModule } from '@bmms/event';
// Strategy Pattern imports
import { PromotionStrategyService } from './strategies/promotion-strategy.service';
import { RetailPromotionStrategy } from './strategies/retail-promotion.strategy';
import { SubscriptionPromotionStrategy } from './strategies/subscription-promotion.strategy';
import { FreemiumPromotionStrategy } from './strategies/freemium-promotion.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule.forRoot({ prefix: 'PROMOTION_SVC' }),
    TypeOrmModule.forFeature([Promotion, PromotionUsage]),
    EventModule,
  ],
  controllers: [PromotionSvcController],
  providers: [
    PromotionSvcService,
    // Strategy services
    PromotionStrategyService,
    RetailPromotionStrategy,
    SubscriptionPromotionStrategy,
    FreemiumPromotionStrategy,
  ],
  exports: [PromotionSvcService, PromotionStrategyService],
})
export class PromotionSvcModule {}
