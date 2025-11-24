import { NestFactory } from '@nestjs/core';
import { paymentSvcModule } from './payment-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  console.log('⏳ Starting Payment Service...');
  const app = await NestFactory.create(paymentSvcModule);
  const configService = app.get(ConfigService);

  // Enable CORS for HTTP endpoints
  app.enableCors();

  // ⭐ Connect Kafka microservice for events
  console.log('⏳ Starting Kafka microservices...');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'payment-svc',
        brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'payment-group',
        allowAutoTopicCreation: true,
      },
    },
  });
  console.log('✅ Kafka consumer configured');

  // ⭐ Connect gRPC microservice for API Gateway
  const grpcUrl = configService.get<string>('GRPC_LISTEN_PAYMENT_URL') || '0.0.0.0:50060';
  console.log('⏳ Starting gRPC server...');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'payment',
      protoPath: join(__dirname, './proto/payment.proto'),
      url: grpcUrl,
    },
  });
  console.log(`✅ gRPC server configured on ${grpcUrl}`);

  await app.startAllMicroservices();
  await app.init();
  console.log('✅ All microservices started!');

  // HTTP server for VNPay callback and testing
  const httpPort = configService.get<number>('PAYMENT_SVC_HTTP_PORT') || 3013;
  
  // Setup Swagger for HTTP endpoints
  const config = new DocumentBuilder()
    .setTitle('Payment Service API')
    .setDescription('Payment Service REST API for VNPay integration and testing')
    .setVersion('1.0')
    .addTag('payments')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  await app.listen(httpPort);
  console.log(`🚀 Payment Service (HTTP) running on http://localhost:${httpPort}`);
  console.log(`📚 Swagger UI available at http://localhost:${httpPort}/api`);
  console.log(`🚀 Payment Service (gRPC) running on ${grpcUrl}`);
  console.log('🚀 Payment Service (Kafka) listening for events');
}
bootstrap();
