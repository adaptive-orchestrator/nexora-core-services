import { NestFactory } from '@nestjs/core';
import { promotionSvcModule } from './promotion-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(promotionSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
