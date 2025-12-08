import { NestFactory } from '@nestjs/core';
import { JobSchedulerModule } from './job-scheduler.module';

async function bootstrap() {
  const app = await NestFactory.create(JobSchedulerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
