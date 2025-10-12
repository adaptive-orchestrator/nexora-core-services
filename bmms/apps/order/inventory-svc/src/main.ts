import { NestFactory } from '@nestjs/core';
import { InventorySvcModule } from './inventory-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(InventorySvcModule);
  await app.listen(process.env.port ?? 3002);
}
bootstrap();
