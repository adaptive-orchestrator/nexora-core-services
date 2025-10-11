import { NestFactory } from '@nestjs/core';
import { inventorySvcModule } from './inventory-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(inventorySvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
