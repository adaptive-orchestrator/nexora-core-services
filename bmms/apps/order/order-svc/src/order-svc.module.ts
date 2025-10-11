import { Module } from '@nestjs/common';
import { orderSvcController } from './order-svc.controller';
import { orderSvcService } from './order-svc.service';

@Module({
  imports: [],
  controllers: [orderSvcController],
  providers: [orderSvcService],
})
export class orderSvcModule {}
