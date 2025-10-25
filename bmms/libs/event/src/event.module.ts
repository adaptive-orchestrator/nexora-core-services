import { Module, DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

export interface EventModuleOptions {
  clientId: string; // Tên service (vd: 'customer-svc', 'order-svc')
  consumerGroupId: string; // Consumer group (vd: 'customer-group')
}

@Module({})
export class EventModule {
  static forRoot(options: EventModuleOptions): DynamicModule {
    const { clientId, consumerGroupId } = options;

    return {
      module: EventModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'KAFKA_SERVICE',
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const brokers = configService
                .get<string>('KAFKA_BROKER', 'localhost:9092')
                .split(',');

              console.log(`🔗 Kafka Config for [${clientId}]:`);
              console.log('Brokers:', brokers);
              console.log('Consumer Group:', consumerGroupId);

              return {
                transport: Transport.KAFKA,
                options: {
                  client: {
                    clientId,
                    brokers,
                  },
                  consumer: {
                    groupId: consumerGroupId,
                    allowAutoTopicCreation: true,
                  },
                  producer: {
                    allowAutoTopicCreation: true,
                  },
                },
              };
            },
          },
          // Alias for backward compatibility
          {
            name: 'EVENT_SERVICE',
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const brokers = configService
                .get<string>('KAFKA_BROKER', 'localhost:9092')
                .split(',');

              return {
                transport: Transport.KAFKA,
                options: {
                  client: {
                    clientId,
                    brokers,
                  },
                  consumer: {
                    groupId: consumerGroupId,
                    allowAutoTopicCreation: true,
                  },
                  producer: {
                    allowAutoTopicCreation: true,
                  },
                },
              };
            },
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}