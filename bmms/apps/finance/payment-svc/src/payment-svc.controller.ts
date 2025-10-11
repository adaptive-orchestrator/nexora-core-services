import { Controller, Get } from '@nestjs/common';
import { paymentSvcService } from './payment-svc.service';

@Controller()
export class paymentSvcController {
  constructor(private readonly paymentSvcService: paymentSvcService) {}

  @Get()
  getHello(): string {
    return this.paymentSvcService.getHello();
  }
}
