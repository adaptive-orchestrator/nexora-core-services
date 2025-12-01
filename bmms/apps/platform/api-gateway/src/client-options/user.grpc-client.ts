import { ConfigService } from '@nestjs/config';
import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

// 10MB max message size
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

export const getUserGrpcClientOptions = (configService: ConfigService): ClientProviderOptions => ({
  name: 'USER_PACKAGE',
  transport: Transport.GRPC,
  options: {
    package: 'user',
    protoPath: join(__dirname, '../proto/user.proto'),
    url: configService.get<string>('GRPC_SERVER_USER_URL'),
    channelOptions: {
      'grpc.max_receive_message_length': MAX_MESSAGE_SIZE,
      'grpc.max_send_message_length': MAX_MESSAGE_SIZE,
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
    },
  },
});
