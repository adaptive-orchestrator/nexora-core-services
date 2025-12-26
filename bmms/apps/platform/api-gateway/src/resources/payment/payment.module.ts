import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { paymentGrpcOptions } from '../../client-options/payment.grpc-client';
import { subscriptionGrpcOptions } from '../../client-options/subscription.grpc-client';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Module({
  imports: [ClientsModule.register([paymentGrpcOptions, subscriptionGrpcOptions])],
  controllers: [PaymentController],
  providers: [PaymentService, SubscriptionService],
})
export class PaymentModule {}
