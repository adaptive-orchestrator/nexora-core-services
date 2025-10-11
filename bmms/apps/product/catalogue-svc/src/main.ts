import { NestFactory } from '@nestjs/core';
import { CatalogueSvcModule } from './catalogue-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(CatalogueSvcModule);
  await app.listen(process.env.port ?? 3001);
}
bootstrap();
