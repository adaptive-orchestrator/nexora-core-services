import { Module } from '@nestjs/common';
import { paymentSvcController } from './payment-svc.controller';
import { paymentSvcService } from './payment-svc.service';

@Module({
  imports: [],
  controllers: [paymentSvcController],
  providers: [paymentSvcService],
})
export class paymentSvcModule {}
