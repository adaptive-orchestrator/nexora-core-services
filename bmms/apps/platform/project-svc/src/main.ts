import { NestFactory } from '@nestjs/core';
import { ProjectSvcModule } from './project-svc.module';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

// Load .env from bmms root directory
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function bootstrap() {
  const configService = new ConfigService();
  const grpcUrl = configService.get('GRPC_LISTEN_PROJECT_URL') || '0.0.0.0:50062';
  
  // Create hybrid application (both gRPC and Kafka)
  const app = await NestFactory.create(ProjectSvcModule);

  // Connect gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'project',
      protoPath: path.join(__dirname, './proto/project.proto'),
      url: grpcUrl,
    },
  });

  await app.startAllMicroservices();
  console.log(`✅ Project Service | gRPC: ${grpcUrl}`);
}
bootstrap();
