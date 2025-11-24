import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

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
  },
};
