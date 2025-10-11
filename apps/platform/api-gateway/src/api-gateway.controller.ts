import { Controller, Get } from '@nestjs/common';
import { apiGatewayService } from './api-gateway.service';

@Controller()
export class apiGatewayController {
  constructor(private readonly apiGatewayService: apiGatewayService) {}

  @Get()
  getHello(): string {
    return this.apiGatewayService.getHello();
  }
}
