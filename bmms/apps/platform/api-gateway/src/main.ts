import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
  }));

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Octaltask API Documentation')
    .setDescription('Documentation for Octaltask application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'accessToken',
    )
    .addTag('Authentication', 'Endpoints for user authentication and authorization')
    .addTag('Customers', 'Endpoints for customer management')
    .addTag('Catalogue', 'Endpoints for products, plans, and features management')
    .addTag('Orders', 'Endpoints for order management (Retail model)')
    .addTag('Subscriptions', 'Endpoints for subscription management (SaaS model)')
    .addTag('Promotions', 'Endpoints for promotion and discount code management')
    .addTag('Invoices', 'Endpoints for invoice and billing management')
    .addTag('Payments', 'Endpoints for payment processing')
    .addTag('Inventory', 'Endpoints for inventory management')
    .build();
    
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('SERVER_PORT') || 3000;
  await app.listen(port);
}
bootstrap();
