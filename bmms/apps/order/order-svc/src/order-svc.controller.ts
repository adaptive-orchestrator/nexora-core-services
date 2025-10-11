import { Controller, Get } from '@nestjs/common';
import { orderSvcService } from './order-svc.service';

@Controller()
export class orderSvcController {
  constructor(private readonly orderSvcService: orderSvcService) {}

  @Get()
  getHello(): string {
    return this.orderSvcService.getHello();
  }
}
