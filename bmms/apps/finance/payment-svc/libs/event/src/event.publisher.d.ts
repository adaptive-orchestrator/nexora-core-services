import { OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
export declare class EventPublisher implements OnModuleInit {
    private readonly kafkaClient;
    constructor(kafkaClient: ClientKafka);
    onModuleInit(): Promise<void>;
    publish<T = any>(topic: string, event: T): Promise<void>;
    publishBatch<T = any>(topic: string, events: T[]): Promise<void>;
    publishWithKey<T = any>(topic: string, key: string, event: T): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
