import { NestFactory } from '@nestjs/core';
import { apiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(apiGatewayModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
