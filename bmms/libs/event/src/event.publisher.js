"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPublisher = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
let EventPublisher = class EventPublisher {
    constructor(kafkaClient) {
        this.kafkaClient = kafkaClient;
    }
    async onModuleInit() {
        await this.kafkaClient.connect();
        console.log('✅ Kafka Producer connected');
    }
    async publish(topic, event) {
        try {
            await this.kafkaClient.emit(topic, event).toPromise();
            console.log(`📤 Event published to [${topic}]:`, event);
        }
        catch (error) {
            console.error(`❌ Failed to publish event to [${topic}]:`, error);
            throw error;
        }
    }
    async publishBatch(topic, events) {
        try {
            const promises = events.map((event) => this.kafkaClient.emit(topic, event).toPromise());
            await Promise.all(promises);
            console.log(`📤 Batch published ${events.length} events to [${topic}]`);
        }
        catch (error) {
            console.error(`❌ Failed to publish batch to [${topic}]:`, error);
            throw error;
        }
    }
    async publishWithKey(topic, key, event) {
        try {
            await this.kafkaClient
                .emit(topic, { key, value: event })
                .toPromise();
            console.log(`📤 Event published to [${topic}] with key [${key}]:`, event);
        }
        catch (error) {
            console.error(`❌ Failed to publish event to [${topic}]:`, error);
            throw error;
        }
    }
    async onModuleDestroy() {
        await this.kafkaClient.close();
        console.log('🔌 Kafka Producer disconnected');
    }
};
exports.EventPublisher = EventPublisher;
exports.EventPublisher = EventPublisher = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('KAFKA_SERVICE')),
    __metadata("design:paramtypes", [microservices_1.ClientKafka])
], EventPublisher);
//# sourceMappingURL=event.publisher.js.map