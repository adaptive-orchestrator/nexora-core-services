import { NestFactory } from '@nestjs/core';
import { subscriptionSvcModule } from './subscription-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(subscriptionSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
