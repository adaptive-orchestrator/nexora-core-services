import { Module } from '@nestjs/common';
import { catalogueSvcController } from './catalogue-svc.controller';
import { catalogueSvcService } from './catalogue-svc.service';

@Module({
  imports: [],
  controllers: [catalogueSvcController],
  providers: [catalogueSvcService],
})
export class catalogueSvcModule {}
