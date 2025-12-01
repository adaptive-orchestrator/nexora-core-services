import { ClientProviderOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ChannelOptions } from '@grpc/grpc-js';

// 10MB max message size
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

// 🚀 gRPC Channel Options for high concurrency
const grpcChannelOptions: ChannelOptions = {
  'grpc.max_receive_message_length': MAX_MESSAGE_SIZE,
  'grpc.max_send_message_length': MAX_MESSAGE_SIZE,
  'grpc.keepalive_time_ms': 10000,           // Send keepalive every 10s
  'grpc.keepalive_timeout_ms': 5000,         // Wait 5s for keepalive response
  'grpc.keepalive_permit_without_calls': 1,  // Allow keepalive pings even without active calls
  'grpc.http2.max_pings_without_data': 0,    // Unlimited pings without data
  'grpc.http2.min_time_between_pings_ms': 10000,
  'grpc.max_connection_idle_ms': 300000,     // 5 minutes idle before close
  'grpc.max_connection_age_ms': 600000,      // Max connection age 10 minutes
  'grpc.enable_retries': 1,                  // Enable retries
  'grpc.service_config': JSON.stringify({
    retryPolicy: {
      maxAttempts: 3,
      initialBackoff: '0.1s',
      maxBackoff: '1s',
      backoffMultiplier: 2,
      retryableStatusCodes: ['UNAVAILABLE', 'DEADLINE_EXCEEDED'],
    },
  }),
};

export const subscriptionGrpcOptions: ClientProviderOptions = {
  name: 'SUBSCRIPTION_PACKAGE',
  transport: Transport.GRPC,
  options: {
    url: process.env.GRPC_SERVER_SUBSCRIPTION_URL || '127.0.0.1:50059',
    package: 'subscription',
    protoPath: join(__dirname, '../proto/subscription.proto'),
    loader: {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
    channelOptions: grpcChannelOptions,
  },
};
