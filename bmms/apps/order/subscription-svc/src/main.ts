import { NestFactory } from '@nestjs/core';
import { subscriptionSvcModule } from './subscription-svc.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(subscriptionSvcModule);
  const configService = app.get(ConfigService);
  
  const grpcUrl = configService.get<string>('GRPC_LISTEN_SUBSCRIPTION_URL') || '0.0.0.0:50059';

  // Connect Kafka microservice for events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'subscription-svc',
        brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'subscription-group',
        allowAutoTopicCreation: true,
      },
    },
  });

  // Connect gRPC microservice for API Gateway
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'subscription',
      protoPath: join(__dirname, './proto/subscription.proto'),
      url: grpcUrl,
      channelOptions: {
        'grpc.max_concurrent_streams': 1000,
        'grpc.max_connection_idle_ms': 300000,
        'grpc.max_connection_age_ms': 600000,
        'grpc.keepalive_time_ms': 10000,
        'grpc.keepalive_timeout_ms': 5000,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.max_pings_without_data': 0,
      },
    },
  });

  await app.startAllMicroservices();
  await app.init();
  
  console.log(`[SubscriptionSvc] Subscription Service | gRPC: ${grpcUrl} | Kafka: listening`);
}

bootstrap();
