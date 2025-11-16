import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AuthModule } from './resources/auth/auth.module';
import { LlmOrchestratorModule } from './resources/llm-orchestrator/llm-orchestrator.module';
import { CatalogueModule } from './resources/catalogue/catalogue.module';
import { InventoryModule } from './resources/inventory/inventory.module';
import { CustomerModule } from './resources/customer/customer.module';
import { OrderModule } from './resources/order/order.module';
import { BillingModule } from './resources/billing/billing.module';
import { PaymentModule } from './resources/payment/payment.module';
import { SubscriptionModule } from './resources/subscription/subscription.module';
import { PromotionModule } from './resources/promotion/promotion.module';
import { AddonModule } from './resources/addon/addon.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '1d' },
    }),
    AuthModule,
    CustomerModule,
    LlmOrchestratorModule,
    CatalogueModule,
    InventoryModule,
    OrderModule,
    BillingModule,
    PaymentModule,
    SubscriptionModule,
    PromotionModule,
    AddonModule,
  ],
  controllers: [
    ApiGatewayController,
  ],
  providers: [
    ApiGatewayService,
    JwtStrategy,
  ],
})
export class ApiGatewayModule {}