import { NestFactory } from '@nestjs/core';
import { CatalogueSvcModule } from './catalogue-svc.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcExceptionFilter } from './filters/grpc-exception.filter';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(CatalogueSvcModule);
  const configService = appContext.get(ConfigService);

  const grpcUrl = configService.get<string>('GRPC_LISTEN_CATALOGUE_URL') || '0.0.0.0:50055';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(CatalogueSvcModule, {
    transport: Transport.GRPC,
    options: {
      package: 'catalogue',
      protoPath: join(__dirname, './proto/catalogue.proto'),
      url: grpcUrl,
    },
  });

  app.useGlobalFilters(new GrpcExceptionFilter());

  await app.listen();
  console.log(`[CatalogueSvc] Catalogue Service | gRPC: ${grpcUrl}`);
}
bootstrap();
