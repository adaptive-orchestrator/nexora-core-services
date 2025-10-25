
import { NestFactory } from '@nestjs/core';
import { OrderSvcModule } from './order-svc.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  // Create application context (no HTTP server, just for DI)
  const app = await NestFactory.create(OrderSvcModule, { logger: ['log', 'error', 'warn'] });

  // 1. Connect gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: process.env.GRPC_LISTEN_ORDER_URL || '0.0.0.0:50057',
      package: 'order',
      protoPath: join(__dirname, './proto/order.proto'),
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  // 2. Connect Kafka microservice
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

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Start only microservices (no HTTP server)
  await app.startAllMicroservices();
  await app.init();
  
  console.log(`✅ Order Service (gRPC) listening on ${process.env.GRPC_LISTEN_ORDER_URL || '0.0.0.0:50057'}`);
  console.log('✅ Kafka Consumer listening for events');
}
bootstrap();