import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

// 10MB max message size for large payment lists
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

export const paymentGrpcOptions: ClientProviderOptions = {
  name: 'PAYMENT_PACKAGE',
  transport: Transport.GRPC,
  options: {
    url: process.env.GRPC_SERVER_PAYMENT_URL || '127.0.0.1:50060',
    package: 'payment',
    protoPath: join(__dirname, '../proto/payment.proto'),
    loader: {
      keepCase: true,
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
};
