import { NestFactory } from '@nestjs/core';
import { CustomerSvcModule } from './customer-svc.module';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env trực tiếp trước khi khởi động NestJS
dotenv.config({ 
  path: path.join(process.cwd(), 'apps/customer/customer-svc/.env') 
});

console.log('🧪 Test direct env loading:');
console.log('DB_HOST from process.env:', process.env.DB_HOST);

async function bootstrap() {
  const app = await NestFactory.create(CustomerSvcModule);
  
  const configService = app.get(ConfigService);
  console.log('🔍 After NestJS bootstrap:');
  console.log('DB_HOST:', configService.get('DB_HOST'));
  console.log('DB_PORT:', configService.get('DB_PORT'));
  
  await app.listen(3001);
}
bootstrap();