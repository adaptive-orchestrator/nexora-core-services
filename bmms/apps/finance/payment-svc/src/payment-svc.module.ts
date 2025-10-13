import { Module } from '@nestjs/common';
import { PaymentController } from './payment-svc.controller';
import { PaymentService } from './payment-svc.service';
import { PaymentEventListener } from './payment.event-listener';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@bmms/db';
import { EventModule } from '@bmms/event';
import { Payment } from './entities/payment.entity';
import { PaymentHistory } from './entities/payment-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Tự động load .env từ root
    }),
    TypeOrmModule.forFeature([ Payment, PaymentHistory]),
    DbModule.forRoot({ prefix: 'PAYMENT_SVC' }),
    EventModule.forRoot({
      clientId: 'payment-svc',
      consumerGroupId: 'payment-group',
    }),],
  controllers: [PaymentController,PaymentEventListener],
  providers: [PaymentService],
})
export class paymentSvcModule { }
