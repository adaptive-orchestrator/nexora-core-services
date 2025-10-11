import { Controller, Get } from '@nestjs/common';
import { subscriptionSvcService } from './subscription-svc.service';

@Controller()
export class subscriptionSvcController {
  constructor(private readonly subscriptionSvcService: subscriptionSvcService) {}

  @Get()
  getHello(): string {
    return this.subscriptionSvcService.getHello();
  }
}
