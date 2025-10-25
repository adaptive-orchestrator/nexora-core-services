import { NestFactory } from '@nestjs/core';
import { BillingSvcModule } from './billing-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(BillingSvcModule, { logger: ['log', 'error', 'warn'] });
  const configService = app.get(ConfigService);
   
  // Connect Kafka microservice for events
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
  console.log('✅ Kafka consumer configured');

  // Connect gRPC microservice for API Gateway
  const grpcUrl = configService.get<string>('GRPC_LISTEN_BILLING_URL') || '0.0.0.0:50058';
  console.log('⏳ Starting gRPC server...');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'billing',
      protoPath: join(__dirname, './proto/billing.proto'),
      url: grpcUrl,
    },
  });
  console.log(`✅ gRPC server configured on ${grpcUrl}`);

  await app.startAllMicroservices();
  await app.init();
  console.log('✅ All microservices started!');
  
  // HTTP server removed - only gRPC + Kafka
  console.log(`✅ Billing Service (gRPC) listening on ${grpcUrl}`);
  console.log('✅ Billing Service (Kafka) listening for events');
}
bootstrap();
