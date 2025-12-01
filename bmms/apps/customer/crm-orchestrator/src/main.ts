import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { crmOrchestratorModule } from './crm-orchestrator.module';

// Load .env from bmms root directory
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function bootstrap() {
  const configService = new ConfigService();
  
  // Create pure microservice (Kafka only, no HTTP)
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    crmOrchestratorModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'crm-orchestrator',
          brokers: (configService.get('KAFKA_BROKER') || 'localhost:9092').split(','),
        },
        consumer: {
          groupId: 'crm-group',
          allowAutoTopicCreation: true,
        },
      },
    },
  );

  await app.listen();
  
  console.log(`✅ CRM Orchestrator | Kafka: listening (order.completed, payment.success, crm.check-churn)`);
}
bootstrap();

