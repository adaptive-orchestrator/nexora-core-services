import { ClientOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

// 10MB max message size for large customer lists
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

export const customerGrpcClientOptions: ClientOptions = {
  transport: Transport.GRPC,
  options: {
    package: 'customer',
    protoPath: join(__dirname, '../proto/customer.proto'),
    url: process.env.GRPC_SERVER_CUSTOMER_URL || '127.0.0.1:50054',
    channelOptions: {
      'grpc.max_receive_message_length': MAX_MESSAGE_SIZE,
      'grpc.max_send_message_length': MAX_MESSAGE_SIZE,
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
    },
  },
};
