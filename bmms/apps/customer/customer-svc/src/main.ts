import { NestFactory } from '@nestjs/core';
import { CustomerSvcModule } from './customer-svc.module';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

// Load .env trực tiếp trước khi khởi động NestJS
dotenv.config({ 
  path: path.join(process.cwd(), 'apps/customer/customer-svc/.env') 
});

async function bootstrap() {
  const app = await NestFactory.create(CustomerSvcModule);
   // ⭐ THÊM DÒNG NÀY
    console.log('⏳ Starting Kafka microservices...');
     app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'customer-svc',
          brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
        },
        consumer: {
          groupId: 'customer-group',
          allowAutoTopicCreation: true,
        },
      },
    });
    await app.startAllMicroservices();
  app.setGlobalPrefix('api');
  console.log('✅ Customer Service running on http://localhost:3000/api');
  await app.listen(3000);
  
}
bootstrap();