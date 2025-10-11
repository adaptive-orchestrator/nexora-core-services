import { NestFactory } from '@nestjs/core';
import { crmOrchestratorModule } from './crm-orchestrator.module';

async function bootstrap() {
  const app = await NestFactory.create(crmOrchestratorModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
