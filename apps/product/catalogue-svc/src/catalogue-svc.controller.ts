import { Controller, Get } from '@nestjs/common';
import { catalogueSvcService } from './catalogue-svc.service';

@Controller()
export class catalogueSvcController {
  constructor(private readonly catalogueSvcService: catalogueSvcService) {}

  @Get()
  getHello(): string {
    return this.catalogueSvcService.getHello();
  }
}
