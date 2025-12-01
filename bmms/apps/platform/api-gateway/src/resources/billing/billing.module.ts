import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { billingGrpcOptions } from '../../client-options/billing.grpc-client';
import { BillingController } from './billing.controller';
import { BillingAliasController } from './billing-alias.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [ClientsModule.register([billingGrpcOptions])],
  controllers: [BillingController, BillingAliasController],
  providers: [BillingService],
})
export class BillingModule {}
