import { NestFactory } from '@nestjs/core';
import { paymentSvcModule } from './payment-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  console.log('⏳ Starting Payment Service...');
  const app = await NestFactory.create(paymentSvcModule);
  const configService = app.get(ConfigService);

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
  const grpcUrl = configService.get<string>('GRPC_LISTEN_PAYMENT_URL') || '0.0.0.0:50059';
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
  // Comment out if you don't need HTTP endpoints
  const httpPort = configService.get<number>('SERVER_PORT') || 3013;
  await app.listen(httpPort);
  console.log(`🚀 Payment Service (HTTP) running on port ${httpPort} - for VNPay callbacks`);
  
  console.log(`🚀 Payment Service (gRPC) running on ${grpcUrl}`);
  console.log('🚀 Payment Service (Kafka) listening for events');
}
bootstrap();
