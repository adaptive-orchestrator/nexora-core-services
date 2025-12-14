import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthModule } from './resources/auth/auth.module';
import { CustomerModule } from './resources/customer/customer.module';
import { LlmOrchestratorModule } from './resources/llm-orchestrator/llm-orchestrator.module';
import { CatalogueModule } from './resources/catalogue/catalogue.module';
import { InventoryModule } from './resources/inventory/inventory.module';
import { OrderModule } from './resources/order/order.module';
import { BillingModule } from './resources/billing/billing.module';
import { PaymentModule } from './resources/payment/payment.module';
import { SubscriptionModule } from './resources/subscription/subscription.module';
import { PromotionModule } from './resources/promotion/promotion.module';
import { AddonModule } from './resources/addon/addon.module';
import { ProjectModule } from './resources/project/project.module';
import { AdminStatsModule } from './resources/admin/admin-stats.module';
import { GrpcMetadataInterceptor } from '@bmms/common';

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
    ProjectModule,
    AdminStatsModule,
  ],
  controllers: [ApiGatewayController],
  providers: [
    ApiGatewayService,
    JwtStrategy,
    // Global interceptor to inject user context into gRPC metadata
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcMetadataInterceptor,
    },
  ],
})
export class ApiGatewayModule {}
