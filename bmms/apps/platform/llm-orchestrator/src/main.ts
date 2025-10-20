import { NestFactory } from '@nestjs/core';
import { LlmOrchestratorModule } from './llm-orchestrator.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(LlmOrchestratorModule);
   
  
    const configService = appContext.get(ConfigService); // ✅ đúng
  const grpcUrl = configService.get<string>('GRPC_LISTEN_LLM_URL');
  
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(LlmOrchestratorModule, {
      transport: Transport.GRPC,
      options: {
        package: 'llm',
        protoPath: join(__dirname, './proto/llm-orchestrator.proto'),
        url: grpcUrl,
      },
    });
  
    await app.listen();
}
bootstrap();
