import { Module } from '@nestjs/common';
import { CatalogueSvcController } from './catalogue-svc.controller';
import { CatalogueSvcService } from './catalogue-svc.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbModule } from '@bmms/db';
import { EventModule } from '@bmms/event';
import { Feature, Plan, Product } from './catalogue.entity';

@Module({
  imports: [ ConfigModule.forRoot({
        isGlobal: true,
        // Tự động load .env từ root
      }),
      TypeOrmModule.forFeature([Plan, Feature,Product]), 
      DbModule.forRoot({ prefix: 'CUSTOMER_SVC' }),
      EventModule.forRoot({
        clientId: 'catalogue-svc',
        consumerGroupId: 'catalogue-group',
      }),],
  controllers: [CatalogueSvcController],
  providers: [CatalogueSvcService],
})
export class CatalogueSvcModule {}
