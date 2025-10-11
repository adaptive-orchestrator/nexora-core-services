import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@bmms/db';
import { CustomerSvcController } from './customer-svc.controller';
import { CustomerSvcService } from './customer-svc.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Tự động load .env từ root
    }),
    // QUAN TRỌNG: Phải truyền prefix khớp với .env
    DbModule.forRoot({ prefix: 'CUSTOMER_SVC' }),
  ],
  controllers: [CustomerSvcController],
  providers: [CustomerSvcService],
})
export class CustomerSvcModule {}