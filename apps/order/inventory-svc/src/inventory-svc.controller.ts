import { Controller, Get } from '@nestjs/common';
import { inventorySvcService } from './inventory-svc.service';

@Controller()
export class inventorySvcController {
  constructor(private readonly inventorySvcService: inventorySvcService) {}

  @Get()
  getHello(): string {
    return this.inventorySvcService.getHello();
  }
}
