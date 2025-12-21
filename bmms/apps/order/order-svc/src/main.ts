
import { NestFactory } from '@nestjs/core';
import { OrderSvcModule } from './order-svc.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcExceptionFilter } from './filters/grpc-exception.filter';

async function bootstrap() {
  const grpcUrl = process.env.GRPC_LISTEN_ORDER_URL || '0.0.0.0:50057';
  
  // Create application context (no HTTP server, just for DI)
  const app = await NestFactory.create(OrderSvcModule, { logger: ['error', 'warn'] });

  // 1. Connect gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: grpcUrl,
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
  app.useGlobalFilters(new GrpcExceptionFilter());

  // Start only microservices (no HTTP server)
  await app.startAllMicroservices();
  await app.init();
  
  console.log(`[OrderSvc] Order Service | gRPC: ${grpcUrl} | Kafka: listening`);
}
bootstrap();