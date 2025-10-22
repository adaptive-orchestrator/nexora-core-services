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

//  const configService = appContext.get(ConfigService);
//   const grpcUrl = configService.get('GRPC_LISTEN_LLM_URL');
//   const httpPort = configService.get('HTTP_PORT') || 3001; // ✅ thêm port cho HTTP

//   // ✅ Tạo HTTP app trước
//   const httpApp = await NestFactory.create(LlmOrchestratorModule);
//   httpApp.enableCors(); // enable CORS nếu cần
  
//   // ✅ Tạo gRPC microservice
//   const grpcApp = httpApp.connectMicroservice<MicroserviceOptions>({
//     transport: Transport.GRPC,
//     options: {
//       package: 'llm',
//       protoPath: join(__dirname, './proto/llm-orchestrator.proto'),
//       url: grpcUrl,
//     },
//   });

//   // ✅ Start cả 2 services
//   await httpApp.startAllMicroservices();
//   await httpApp.listen(httpPort);
  
//   console.log(`🚀 HTTP Server running on: http://localhost:${httpPort}`);
//   console.log(`🚀 gRPC Server running on: ${grpcUrl}`);