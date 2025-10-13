import { Module } from '@nestjs/common';
import { InventoryController } from './inventory-svc.controller';
import { InventoryService } from './inventory-svc.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbModule } from '@bmms/db';
import { EventModule } from '@bmms/event';
import { Inventory } from './entities/inventory.entity';
import { InventoryReservation } from './entities/inventory-reservation.entity';
import { InventoryHistory } from './entities/inventory-history.entity';
import { InventoryEventListener } from './inventory.event-listener';

@Module({
  imports: [
    ConfigModule.forRoot({
          isGlobal: true,
          // Tự động load .env từ root
        }),
        TypeOrmModule.forFeature([Inventory, InventoryReservation, InventoryHistory]), 
        DbModule.forRoot({ prefix: 'INVENTORY_SVC' }),
        EventModule.forRoot({
          clientId: 'inventory-svc',
          consumerGroupId: 'inventory-group',
        }),
  ],
  controllers: [InventoryController],
  providers: [InventoryService,InventoryEventListener],
})
export class InventorySvcModule {}
