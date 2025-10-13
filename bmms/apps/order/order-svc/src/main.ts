
import { NestFactory } from '@nestjs/core';
import { OrderSvcModule } from './order-svc.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  
 const app = await NestFactory.create(OrderSvcModule);
 app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(process.env.port ?? 3011);
  console.log('✅ Order Service running on port 3011');
  console.log('✅ Kafka Consumer listening for events');
}
bootstrap();