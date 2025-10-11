import { NestFactory } from '@nestjs/core';
import {customerSvcModule } from './customer-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(customerSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
