import { Controller, Get } from '@nestjs/common';
import { CustomerSvcService } from './customer-svc.service';

@Controller()
export class CustomerSvcController {
  constructor(private readonly CustomerSvcService: CustomerSvcService) {}

  @Get()
  getHello(): string {
    return this.CustomerSvcService.getHello();
  }
}
