import { NestFactory } from '@nestjs/core';
import { pricingEngineModule } from './pricing-engine.module';

async function bootstrap() {
  const app = await NestFactory.create(pricingEngineModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
