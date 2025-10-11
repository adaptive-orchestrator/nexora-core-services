import { Controller, Get } from '@nestjs/common';
import { customerSvcService } from './customer-svc.service';

@Controller()
export class customerSvcController {
  constructor(private readonly customerSvcService: customerSvcService) {}

  @Get()
  getHello(): string {
    return this.customerSvcService.getHello();
  }
}
