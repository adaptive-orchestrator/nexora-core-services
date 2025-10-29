import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
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
    TypeOrmModule.forFeature([OrderHistory, OrderItem, Order]),
    DbModule.forRoot({ prefix: 'ORDER_SVC' }),
    EventModule.forRoot({
      clientId: 'order-svc',
      consumerGroupId: 'order-group',
    }),
    // gRPC clients
    ClientsModule.register([
      {
        name: 'CUSTOMER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'customer',
          protoPath: join(__dirname, 'proto/customer.proto'),
          url: process.env.GRPC_SERVER_CUSTOMER_URL || '127.0.0.1:50052',
        },
      },
      {
        name: 'CATALOGUE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'catalogue',
          protoPath: join(__dirname, 'proto/catalogue.proto'),
          url: process.env.GRPC_SERVER_CATALOGUE_URL || '127.0.0.1:50055',
        },
      },
      {
        name: 'INVENTORY_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'inventory',
          protoPath: join(__dirname, 'proto/inventory.proto'),
          url: process.env.GRPC_SERVER_INVENTORY_URL || '127.0.0.1:50056',
        },
      },
    ]),
  ],
  controllers: [OrderSvcController, OrderEventListener],
  providers: [OrderSvcService],
})
export class OrderSvcModule {}
