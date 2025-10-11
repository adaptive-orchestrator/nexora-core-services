import { Controller, Get } from '@nestjs/common';
import { pricingEngineService } from './pricing-engine.service';

@Controller()
export class pricingEngineController {
  constructor(private readonly pricingEngineService: pricingEngineService) {}

  @Get()
  getHello(): string {
    return this.pricingEngineService.getHello();
  }
}
