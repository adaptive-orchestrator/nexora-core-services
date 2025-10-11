import { NestFactory } from '@nestjs/core';
import { llmOrchestratorModule } from './llm-orchestrator.module';

async function bootstrap() {
  const app = await NestFactory.create(llmOrchestratorModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
