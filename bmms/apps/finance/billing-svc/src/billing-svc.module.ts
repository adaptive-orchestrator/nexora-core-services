import { Module } from '@nestjs/common';
import { billingSvcController } from './billing-svc.controller';
import { billingSvcService } from './billing-svc.service';

@Module({
  imports: [],
  controllers: [billingSvcController],
  providers: [billingSvcService],
})
export class billingSvcModule {}
