import { Module, DynamicModule, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { debug } from '@bmms/common';
import { Partitioners } from 'kafkajs';
import { EventPublisher } from './event.publisher';
import { EventService } from './event.service';

export interface EventModuleOptions {
  clientId: string; // Tên service (vd: 'customer-svc', 'order-svc')
  consumerGroupId: string; // Consumer group (vd: 'customer-group')
}

/**
 * EventModule - Kafka-based event system for microservices communication
 * 
 * This module provides:
 * - EventPublisher: For publishing events to Kafka topics
 * - KAFKA_SERVICE / EVENT_SERVICE: Raw Kafka client for advanced usage
 * 
 * Usage:
 * ```typescript
 * // In your service module
 * @Module({
 *   imports: [
 *     EventModule.forRoot({
 *       clientId: 'my-service',
 *       consumerGroupId: 'my-service-group',
 *     }),
 *   ],
 * })
 * export class MyServiceModule {}
 * 
 * // In your service
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly eventPublisher: EventPublisher) {}
 *   
 *   async doSomething() {
 *     await this.eventPublisher.publish('topic.name', { data: 'value' });
 *   }
 * }
 * ```
 */
@Global()
@Module({})
export class EventModule {
  static forRoot(options: EventModuleOptions): DynamicModule {
    const { clientId, consumerGroupId } = options;

    return {
      module: EventModule,
      global: true, // Make this module global
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

              debug.log(`[EventModule] Kafka Config for [${clientId}]:`);
              debug.log('Brokers:', brokers);
              debug.log('Consumer Group:', consumerGroupId);

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
                    createPartitioner: Partitioners.LegacyPartitioner,
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
                    createPartitioner: Partitioners.LegacyPartitioner,
                  },
                },
              };
            },
          },
        ]),
      ],
      providers: [EventPublisher, EventService],
      exports: [ClientsModule, EventPublisher, EventService],
    };
  }
}