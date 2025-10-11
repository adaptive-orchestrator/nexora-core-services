import { Controller, Get } from '@nestjs/common';
import { promotionSvcService } from './promotion-svc.service';

@Controller()
export class promotionSvcController {
  constructor(private readonly promotionSvcService: promotionSvcService) {}

  @Get()
  getHello(): string {
    return this.promotionSvcService.getHello();
  }
}
