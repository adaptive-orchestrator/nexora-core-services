import { NestFactory } from '@nestjs/core';
import { BillingSvcModule } from './billing-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(BillingSvcModule, { logger: ['error', 'warn'] });
  const configService = app.get(ConfigService);
   
  // Connect Kafka microservice for events
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

  // Connect gRPC microservice for API Gateway
  const grpcUrl = configService.get<string>('GRPC_LISTEN_BILLING_URL') || '0.0.0.0:50058';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'billing',
      protoPath: join(__dirname, './proto/billing.proto'),
      url: grpcUrl,
    },
  });

  await app.startAllMicroservices();
  await app.init();
  
  console.log(`[BillingSvc] Billing Service | gRPC: ${grpcUrl} | Kafka: listening`);
}
bootstrap();
