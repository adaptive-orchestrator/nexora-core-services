import { NestFactory } from '@nestjs/core';
import { LlmOrchestratorModule } from './llm-orchestrator.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  // Create HTTP app first
  const httpApp = await NestFactory.create(LlmOrchestratorModule);
  httpApp.enableCors();
  
  // Get config
  const configService = httpApp.get(ConfigService);
  const grpcUrl = configService.get('GRPC_LISTEN_LLM_URL') || '0.0.0.0:50052';
  const httpPort = configService.get('LLM_ORCHESTRATOR_PORT') || 3001;

  // Add gRPC microservice to HTTP app
  httpApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'llm',
      protoPath: join(__dirname, './proto/llm-orchestrator.proto'),
      url: grpcUrl,
      loader: {
        keepCase: true, // Keep snake_case field names in proto
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  // Start all microservices + HTTP
  await httpApp.startAllMicroservices();
  await httpApp.listen(httpPort);
  
  console.log(`[LlmOrchestrator] LLM Orchestrator HTTP: http://localhost:${httpPort} | gRPC: ${grpcUrl}`);
}
bootstrap();
