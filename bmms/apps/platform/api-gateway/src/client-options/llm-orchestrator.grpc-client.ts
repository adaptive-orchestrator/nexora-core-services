import { ConfigService } from '@nestjs/config';
import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

// 10MB max message size for large LLM responses
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

export const getLlmGrpcClientOptions = (configService: ConfigService): ClientProviderOptions => ({
  name: 'LLM_PACKAGE',
  transport: Transport.GRPC,
  options: {
    package: 'llm',
    protoPath: join(__dirname, '../proto/llm-orchestrator.proto'),
    url: configService.get<string>('GRPC_SERVER_LLM_URL'),
    loader: {
      keepCase: true, // Keep snake_case field names (don't convert to camelCase)
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
    channelOptions: {
      'grpc.max_receive_message_length': MAX_MESSAGE_SIZE,
      'grpc.max_send_message_length': MAX_MESSAGE_SIZE,
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
    },
  },
});
