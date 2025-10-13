import { NestFactory } from '@nestjs/core';
import { BillingSvcModule } from './billing-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(BillingSvcModule);
   
  // ⭐ THÊM DÒNG NÀY
  console.log('⏳ Starting Kafka microservices...');
   app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'billing-svc',
        brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'billing-group',
        allowAutoTopicCreation: true,
      },
    },
  });
  await app.startAllMicroservices();
  console.log('✅ Kafka consumer started! Group: billing-group');
  
  await app.listen(3003); // hoặc port bạn đang dùng
  console.log('🚀 Billing Service running on port 3003');
}
bootstrap();
