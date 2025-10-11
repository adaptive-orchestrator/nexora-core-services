import { Module } from '@nestjs/common';
import { apiGatewayController } from './api-gateway.controller';
import { apiGatewayService } from './api-gateway.service';

@Module({
  imports: [],
  controllers: [apiGatewayController],
  providers: [apiGatewayService],
})
export class apiGatewayModule {}
