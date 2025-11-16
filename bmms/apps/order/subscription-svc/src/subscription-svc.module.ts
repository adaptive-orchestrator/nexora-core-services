import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbModule } from '@bmms/db';
import { EventModule } from '@bmms/event';

import { subscriptionSvcController } from './subscription-svc.controller';
import { subscriptionSvcService } from './subscription-svc.service';
import { SubscriptionEventListener } from './subscription.event-listener';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionHistory } from './entities/subscription-history.entity';
import { ProrationService } from './proration/proration.service';
import { AddonController } from './addon.controller';
import { AddonService } from './addon.service';
import { Addon } from './entities/addon.entity';
import { UserAddon } from './entities/user-addon.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([Subscription, SubscriptionHistory, Addon, UserAddon]),
    DbModule.forRoot({ prefix: 'SUBSCRIPTION_SVC' }),
    EventModule.forRoot({
      clientId: 'subscription-svc',
      consumerGroupId: 'subscription-group',
    }),
    // gRPC clients
    ClientsModule.register([
      {
        name: 'CUSTOMER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'customer',
          protoPath: './apps/customer/customer-svc/src/proto/customer.proto',
          url: process.env.GRPC_SERVER_CUSTOMER_URL || '127.0.0.1:50052',
        },
      },
      {
        name: 'CATALOGUE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'catalogue',
          protoPath: './apps/product/catalogue-svc/src/proto/catalogue.proto',
          url: process.env.GRPC_SERVER_CATALOGUE_URL || '127.0.0.1:50055',
        },
      },
    ]),
  ],
  controllers: [subscriptionSvcController, SubscriptionEventListener, AddonController],
  providers: [subscriptionSvcService, ProrationService, AddonService],
})
export class subscriptionSvcModule {}
