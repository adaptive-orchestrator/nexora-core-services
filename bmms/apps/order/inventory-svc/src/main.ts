import { NestFactory } from '@nestjs/core';
import { InventorySvcModule } from './inventory-svc.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(InventorySvcModule, { logger: ['log', 'error', 'warn'] });
  const configService = app.get(ConfigService);

  // Connect Kafka microservice for events
  console.log('⏳ Starting Kafka microservices...');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'inventory-svc',
        brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'inventory-group',
        allowAutoTopicCreation: true,
      },
    },
  });
  console.log('✅ Kafka consumer configured');

  // Connect gRPC microservice
  const grpcUrl = configService.get<string>('GRPC_LISTEN_INVENTORY_URL') || '0.0.0.0:50056';
  console.log('⏳ Starting gRPC server...');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'inventory',
      protoPath: join(__dirname, './proto/inventory.proto'),
      url: grpcUrl,
    },
  });
  console.log(`✅ gRPC server configured on ${grpcUrl}`);

  await app.startAllMicroservices();
  await app.init();
  console.log('✅ All microservices started!');
  
  console.log(`✅ Inventory Service (gRPC) listening on ${grpcUrl}`);
  console.log('✅ Inventory Service (Kafka) listening for events');
}
bootstrap();
