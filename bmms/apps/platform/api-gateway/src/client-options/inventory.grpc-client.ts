import { ConfigService } from '@nestjs/config';
import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

export const getInventoryGrpcClientOptions = (configService: ConfigService): ClientProviderOptions => ({
  name: 'INVENTORY_PACKAGE',
  transport: Transport.GRPC,
  options: {
    package: 'inventory',
    protoPath: join(__dirname, '../proto/inventory.proto'),
    url: configService.get<string>('GRPC_SERVER_INVENTORY_URL'),
    channelOptions: {
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.min_time_between_pings_ms': 10000,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.max_receive_message_length': 10 * 1024 * 1024,
      'grpc.max_send_message_length': 10 * 1024 * 1024,
    },
  },
});
