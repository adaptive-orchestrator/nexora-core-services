import { NestFactory } from '@nestjs/core';
import { AuthSvcModule } from './auth-svc.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AuthSvcModule);
  const configService = appContext.get(ConfigService);

  const grpcUrl = configService.get<string>('GRPC_LISTEN_AUTH_URL');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AuthSvcModule, {
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(__dirname, './proto/auth.proto'),
      url: grpcUrl,
    },
  });

  await app.listen();
}
bootstrap();
