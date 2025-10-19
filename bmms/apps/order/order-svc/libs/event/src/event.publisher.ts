import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class EventPublisher implements OnModuleInit {
  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Connect to Kafka when module initializes
    await this.kafkaClient.connect();
    console.log('✅ Kafka Producer connected');
  }

  /**
   * Publish an event to a Kafka topic
   * @param topic - Topic name (e.g., 'customer.created', 'order.placed')
   * @param event - Event data
   */
  async publish<T = any>(topic: string, event: T): Promise<void> {
    try {
      await this.kafkaClient.emit(topic, event).toPromise();
      console.log(`📤 Event published to [${topic}]:`, event);
    } catch (error) {
      console.error(`❌ Failed to publish event to [${topic}]:`, error);
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
      console.log(`📤 Batch published ${events.length} events to [${topic}]`);
    } catch (error) {
      console.error(`❌ Failed to publish batch to [${topic}]:`, error);
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
      console.log(`📤 Event published to [${topic}] with key [${key}]:`, event);
    } catch (error) {
      console.error(`❌ Failed to publish event to [${topic}]:`, error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
    console.log('🔌 Kafka Producer disconnected');
  }
}