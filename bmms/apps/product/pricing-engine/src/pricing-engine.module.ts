import { Module } from '@nestjs/common';
import { pricingEngineController } from './pricing-engine.controller';
import { pricingEngineService } from './pricing-engine.service';

@Module({
  imports: [],
  controllers: [pricingEngineController],
  providers: [pricingEngineService],
})
export class pricingEngineModule {}
