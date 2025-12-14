import { Module, DynamicModule, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

/**
 * StripeModule - Leaf Module (Không phụ thuộc module nào khác)
 * 
 * Chỉ chịu trách nhiệm:
 * - Khởi tạo Stripe Client
 * - Cung cấp StripeService với các tính năng thuần Stripe API
 * - Verify webhook signature
 * 
 * KHÔNG BAO GIỜ import PaymentSvcModule hoặc inject PaymentService vào đây
 * 
 * LƯU Ý: Sử dụng forRootAsync pattern để tránh circular dependency
 */
@Module({})
export class StripeModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StripeModule,
      providers: [
        {
          provide: STRIPE_CLIENT,
          useFactory: async (configService: ConfigService) => {
            const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
            
            if (!secretKey) {
              throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
            }

            return new Stripe(secretKey, {
              // Use 'as any' to bypass strict version check - Stripe SDK is backwards compatible
              apiVersion: '2024-12-18.acacia' as any,
              typescript: true,
            });
          },
          inject: [ConfigService],
        },
        StripeService,
      ],
      exports: [STRIPE_CLIENT, StripeService],
    };
  }
}
