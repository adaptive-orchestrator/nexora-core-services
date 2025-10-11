import { Controller, Get } from '@nestjs/common';
import { billingSvcService } from './billing-svc.service';

@Controller()
export class billingSvcController {
  constructor(private readonly billingSvcService: billingSvcService) {}

  @Get()
  getHello(): string {
    return this.billingSvcService.getHello();
  }
}
