import { NestFactory } from '@nestjs/core';
import { CustomerSvcModule } from './customer-svc.module';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

// Load .env from bmms root directory
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function bootstrap() {
  const configService = new ConfigService();
  const grpcUrl = configService.get('GRPC_LISTEN_CUSTOMER_URL') || '0.0.0.0:50054';
  
  // Create hybrid application (both gRPC and Kafka)
  const app = await NestFactory.create(CustomerSvcModule);

  // Connect gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'customer',
      protoPath: path.join(__dirname, './proto/customer.proto'),
      url: grpcUrl,
    },
  });

  // Connect Kafka for event listening
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'customer-svc',
        brokers: (configService.get('KAFKA_BROKER') || 'localhost:9092').split(','),
      },
      consumer: {
        groupId: 'customer-group',
        allowAutoTopicCreation: true,
      },
    },
  });

  await app.startAllMicroservices();
  console.log(`✅ Customer Service | gRPC: ${grpcUrl} | Kafka: listening`);
}
bootstrap();