import { NestFactory } from '@nestjs/core';
import { paymentSvcModule } from './payment-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(paymentSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
