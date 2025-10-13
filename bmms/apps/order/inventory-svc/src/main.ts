import { NestFactory } from '@nestjs/core';
import { InventorySvcModule } from './inventory-svc.module';

async function bootstrap() {
  const app = await NestFactory.create(InventorySvcModule);
  await app.startAllMicroservices();
  await app.listen(process.env.port ?? 3002);
   
  console.log('🚀 Billing Service is running on: http://localhost:3001');
  console.log('🎧 Kafka Consumer is listening...'); // Log để biết đã start
}
bootstrap();
