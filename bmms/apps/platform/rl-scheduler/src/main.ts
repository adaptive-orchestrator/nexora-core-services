import { NestFactory } from '@nestjs/core';
import { rlSchedulerModule } from './rl-scheduler.module';

async function bootstrap() {
  const app = await NestFactory.create(rlSchedulerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
