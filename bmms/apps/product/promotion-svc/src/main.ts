import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PromotionSvcModule } from './promotion-svc.module';

async function bootstrap() {
  const grpcUrl = process.env.GRPC_LISTEN_PROMOTION_URL || '0.0.0.0:50061';
  
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PromotionSvcModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'promotion',
        protoPath: join(__dirname, './proto/promotion.proto'),
        url: grpcUrl,
      },
    },
  );

  await app.listen();
  console.log(`✅ Promotion Service | gRPC: ${grpcUrl}`);
}

bootstrap();
