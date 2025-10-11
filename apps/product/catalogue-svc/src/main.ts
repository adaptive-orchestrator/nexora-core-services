import { NestFactory } from '@nestjs/core';
import { catalogueSvcModule } from './catalogue-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(catalogueSvcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
