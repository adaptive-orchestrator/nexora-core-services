import { Module } from '@nestjs/common';
import { subscriptionSvcController } from './subscription-svc.controller';
import { subscriptionSvcService } from './subscription-svc.service';

@Module({
  imports: [],
  controllers: [subscriptionSvcController],
  providers: [subscriptionSvcService],
})
export class subscriptionSvcModule {}
