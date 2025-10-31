import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { rlSchedulerController } from './rl-scheduler.controller';
import { rlSchedulerService } from './rl-scheduler.service';
import { SubscriptionRenewalTask } from './tasks/subscription-renewal.task';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.register([
      {
        name: 'SUBSCRIPTION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'subscription',
          protoPath: join(__dirname, 'proto/subscription.proto'),
          url: process.env.GRPC_SERVER_SUBSCRIPTION_URL || 'localhost:50059',
        },
      },
      {
        name: 'BILLING_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'billing',
          protoPath: join(__dirname, '/proto/billing.proto'),
          url: process.env.GRPC_SERVER_BILLING_URL || 'localhost:50058',
        },
      },
    ]),
  ],
  controllers: [rlSchedulerController],
  providers: [rlSchedulerService, SubscriptionRenewalTask],
})
export class rlSchedulerModule {}
