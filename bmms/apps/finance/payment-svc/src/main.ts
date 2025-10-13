import { NestFactory } from '@nestjs/core';
import { paymentSvcModule } from './payment-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  console.log('⏳ Starting Kafka microservices...');
  const app = await NestFactory.create(paymentSvcModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'payment-svc',
        brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'payment-group',
        allowAutoTopicCreation: true,
      },
    },
  });
 await app.startAllMicroservices();
  console.log('✅ Kafka consumer started! Group: payment-group');
  await app.listen(process.env.port ?? 3015);
}
bootstrap();
