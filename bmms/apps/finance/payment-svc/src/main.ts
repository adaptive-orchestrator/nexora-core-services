import { NestFactory } from '@nestjs/core';
import { paymentSvcModule } from './payment-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(paymentSvcModule);
  const configService = app.get(ConfigService);

  // Enable CORS for HTTP endpoints
  app.enableCors();

  // Connect Kafka microservice for events
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

  // Connect gRPC microservice for API Gateway
  const grpcUrl = configService.get<string>('GRPC_LISTEN_PAYMENT_URL') || '0.0.0.0:50060';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'payment',
      protoPath: join(__dirname, './proto/payment.proto'),
      url: grpcUrl,
    },
  });

  await app.startAllMicroservices();
  await app.init();

  // HTTP server for VNPay callback and testing
  const httpPort = configService.get<number>('PAYMENT_SVC_HTTP_PORT') || 3013;
  
  // Setup Swagger for HTTP endpoints
  const config = new DocumentBuilder()
    .setTitle('Payment Service API')
    .setDescription('Payment Service REST API for VNPay integration')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  await app.listen(httpPort);
  console.log(`[PaymentSvc] Payment Service | HTTP: http://localhost:${httpPort} | gRPC: ${grpcUrl} | Kafka: listening`);
}
bootstrap();
