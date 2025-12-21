import { ClientOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

// 10MB max message size
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

export const promotionGrpcOptions: ClientOptions = {
  transport: Transport.GRPC,
  options: {
    package: 'promotion',
    protoPath: join(__dirname, '../proto/promotion.proto'),
    url: process.env.GRPC_SERVER_PROMOTION_URL || 'localhost:50061',
    channelOptions: {
      'grpc.max_receive_message_length': MAX_MESSAGE_SIZE,
      'grpc.max_send_message_length': MAX_MESSAGE_SIZE,
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
    },
  },
};
