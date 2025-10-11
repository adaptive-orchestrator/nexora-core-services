import { Module } from '@nestjs/common';
import { promotionSvcController } from './promotion-svc.controller';
import { promotionSvcService } from './promotion-svc.service';

@Module({
  imports: [],
  controllers: [promotionSvcController],
  providers: [promotionSvcService],
})
export class promotionSvcModule {}
