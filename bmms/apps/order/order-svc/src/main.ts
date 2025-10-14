
import { NestFactory } from '@nestjs/core';
import { OrderSvcModule } from './order-svc.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  
 const app = await NestFactory.create(OrderSvcModule);
  // ⭐ THÊM DÒNG NÀY
  console.log('⏳ Starting Kafka microservices...');
   app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'order-svc',
        brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'order-group',
        allowAutoTopicCreation: true,
      },
    },
  });
  await app.startAllMicroservices();
 app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(process.env.port ?? 3011);
  console.log('✅ Order Service running on port 3011');
  console.log('✅ Kafka Consumer listening for events');
}
bootstrap();