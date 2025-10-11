import { NestFactory } from '@nestjs/core';
import { billingSvcModule } from './billing-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(billingSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
