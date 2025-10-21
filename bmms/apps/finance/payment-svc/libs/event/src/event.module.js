"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EventModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventModule = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const config_1 = require("@nestjs/config");
let EventModule = EventModule_1 = class EventModule {
    static forRoot(options) {
        const { clientId, consumerGroupId } = options;
        return {
            module: EventModule_1,
            imports: [
                microservices_1.ClientsModule.registerAsync([
                    {
                        name: 'KAFKA_SERVICE',
                        imports: [config_1.ConfigModule],
                        inject: [config_1.ConfigService],
                        useFactory: (configService) => {
                            const brokers = configService
                                .get('KAFKA_BROKER', 'localhost:9092')
                                .split(',');
                            console.log(`🔗 Kafka Config for [${clientId}]:`);
                            console.log('Brokers:', brokers);
                            console.log('Consumer Group:', consumerGroupId);
                            return {
                                transport: microservices_1.Transport.KAFKA,
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
            exports: [microservices_1.ClientsModule],
        };
    }
};
exports.EventModule = EventModule;
exports.EventModule = EventModule = EventModule_1 = __decorate([
    (0, common_1.Module)({})
], EventModule);
//# sourceMappingURL=event.module.js.map