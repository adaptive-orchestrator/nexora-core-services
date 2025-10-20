import { ConfigService } from '@nestjs/config';
import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

export const getLlmGrpcClientOptions = (configService: ConfigService): ClientProviderOptions => ({
  name: 'LLM_PACKAGE',
  transport: Transport.GRPC,
  options: {
    package: 'llm',
    protoPath: join(__dirname, '../proto/llm-orchestrator.proto'),
    url: configService.get<string>('GRPC_SERVER_LLM_URL'),
  },
});
