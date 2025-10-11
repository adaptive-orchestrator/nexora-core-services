import { NestFactory } from '@nestjs/core';
import { orderSvcModule } from './order-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(orderSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
