import { NestFactory } from '@nestjs/core';
import { InventorySvcModule } from './inventory-svc.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(InventorySvcModule, { logger: ['error', 'warn'] });
  const configService = app.get(ConfigService);

  // Connect Kafka microservice for events
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

  // Connect gRPC microservice
  const grpcUrl = configService.get<string>('GRPC_LISTEN_INVENTORY_URL') || '0.0.0.0:50056';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'inventory',
      protoPath: join(__dirname, './proto/inventory.proto'),
      url: grpcUrl,
    },
  });

  await app.startAllMicroservices();

  // Start HTTP server for health checks
  const port = configService.get<number>('PORT') || 3013;
  await app.listen(port);

  console.log(`✅ Inventory Service | HTTP: ${port} | gRPC: ${grpcUrl} | Kafka: listening`);
}
bootstrap();
