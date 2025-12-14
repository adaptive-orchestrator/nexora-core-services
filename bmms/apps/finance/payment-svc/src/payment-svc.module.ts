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
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';
import { StripeModule } from './stripe/stripe.module';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

/**
 * PaymentSvcModule - Root Module
 * 
 * Cấu trúc phụ thuộc một chiều (Uni-directional):
 * - PaymentSvcModule import StripeModule (OK)
 * - StripeModule KHÔNG BAO GIỜ import PaymentSvcModule (Tránh vòng lặp)
 * 
 * Flow xử lý Webhook:
 * 1. StripeWebhookController nhận request từ Stripe
 * 2. Gọi StripeService.verifyWebhookSignature() để verify
 * 3. StripeWebhookService xử lý business logic và update database
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Tự động load .env từ root
    }),
    TypeOrmModule.forFeature([Payment, PaymentHistory, StripeWebhookEvent]),
    DbModule.forRoot({ prefix: 'PAYMENT_SVC' }),
    EventModule.forRoot({
      clientId: 'payment-svc',
      consumerGroupId: 'payment-group',
    }),
    StripeModule.forRootAsync(), // Sử dụng dynamic module pattern
  ],
  controllers: [PaymentController, PaymentEventListener, StripeWebhookController],
  providers: [PaymentService, StripeWebhookService],
  exports: [PaymentService],
})
export class paymentSvcModule {}
