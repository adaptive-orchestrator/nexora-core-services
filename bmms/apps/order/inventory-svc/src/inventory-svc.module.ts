import { Module } from '@nestjs/common';
import { inventorySvcController } from './inventory-svc.controller';
import { inventorySvcService } from './inventory-svc.service';

@Module({
  imports: [],
  controllers: [inventorySvcController],
  providers: [inventorySvcService],
})
export class inventorySvcModule {}
