import { ClientOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

export const customerGrpcClientOptions: ClientOptions = {
  transport: Transport.GRPC,
  options: {
    package: 'customer',
    protoPath: join(__dirname, '../proto/customer.proto'),
    url: process.env.GRPC_SERVER_CUSTOMER_URL || '127.0.0.1:50054',
  },
};
