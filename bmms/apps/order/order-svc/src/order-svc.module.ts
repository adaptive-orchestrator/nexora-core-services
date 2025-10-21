import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@bmms/db';
import { EventModule } from '@bmms/event';
import { OrderSvcController } from './order-svc.controller';
import { OrderSvcService } from './order-svc.service';
import { OrderEventListener } from './order.event-listener';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderHistory } from './entities/order-history.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([OrderHistory,OrderItem,Order]), 
    DbModule.forRoot({ prefix: 'ORDER_SVC' }),
    EventModule.forRoot({
      clientId: 'order-svc',
      consumerGroupId: 'order-group',
    }),
  ],
  controllers: [OrderSvcController, OrderEventListener],
  providers: [OrderSvcService],
})
export class OrderSvcModule {}