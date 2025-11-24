import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'order',
          protoPath: join(__dirname, '../../proto/order.proto'),
          url: process.env.ORDER_SERVICE_URL || 'localhost:50054',
        },
      },
      {
        name: 'SUBSCRIPTION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'subscription',
          protoPath: join(__dirname, '../../proto/subscription.proto'),
          url: process.env.SUBSCRIPTION_SERVICE_URL || 'localhost:50056',
        },
      },
      {
        name: 'CUSTOMER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'customer',
          protoPath: join(__dirname, '../../proto/customer.proto'),
          url: process.env.CUSTOMER_SERVICE_URL || 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
})
export class AdminStatsModule {}
