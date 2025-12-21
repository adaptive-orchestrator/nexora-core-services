import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { debug } from '@bmms/common';

@Injectable()
export class EventPublisher implements OnModuleInit {
  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Connect to Kafka when module initializes
    await this.kafkaClient.connect();
    debug.log('[EventPublisher] Kafka Producer connected');
  }

  /**
   * Publish an event to a Kafka topic
   * @param topic - Topic name (e.g., 'customer.created', 'order.placed')
   * @param event - Event data
   */
  async publish<T = any>(topic: string, event: T): Promise<void> {
    try {
      await this.kafkaClient.emit(topic, event).toPromise();
      debug.log(`[EventPublisher] Event published to [${topic}]:`, event);
    } catch (error) {
      debug.error(`[EventPublisher] Failed to publish event to [${topic}]:`, error);
      throw error;
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch<T = any>(topic: string, events: T[]): Promise<void> {
    try {
      const promises = events.map((event) =>
        this.kafkaClient.emit(topic, event).toPromise(),
      );
      await Promise.all(promises);
      debug.log(`[EventPublisher] Batch published ${events.length} events to [${topic}]`);
    } catch (error) {
      debug.error(`[EventPublisher] Failed to publish batch to [${topic}]:`, error);
      throw error;
    }
  }

  /**
   * Publish event with key (for partitioning)
   */
  async publishWithKey<T = any>(
    topic: string,
    key: string,
    event: T,
  ): Promise<void> {
    try {
      await this.kafkaClient
        .emit(topic, { key, value: event })
        .toPromise();
      debug.log(`[EventPublisher] Event published to [${topic}] with key [${key}]:`, event);
    } catch (error) {
      debug.error(`[EventPublisher] Failed to publish event to [${topic}]:`, error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
    debug.log('[EventPublisher] Kafka Producer disconnected');
  }
}