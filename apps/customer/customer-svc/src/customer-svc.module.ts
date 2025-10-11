import { Module } from '@nestjs/common';
import { customerSvcController } from './customer-svc.controller';
import { customerSvcService } from './customer-svc.service';

@Module({
  imports: [],
  controllers: [customerSvcController],
  providers: [customerSvcService],
})
export class customerSvcModule {}
