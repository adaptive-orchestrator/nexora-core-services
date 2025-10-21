"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventModule = void 0;
var common_1 = require("@nestjs/common");
var microservices_1 = require("@nestjs/microservices");
var config_1 = require("@nestjs/config");
var EventModule = /** @class */ (function () {
    function EventModule() {
    }
    EventModule_1 = EventModule;
    EventModule.forRoot = function (options) {
        var clientId = options.clientId, consumerGroupId = options.consumerGroupId;
        return {
            module: EventModule_1,
            imports: [
                microservices_1.ClientsModule.registerAsync([
                    {
                        name: 'KAFKA_SERVICE',
                        imports: [config_1.ConfigModule],
                        inject: [config_1.ConfigService],
                        useFactory: function (configService) {
                            var brokers = configService
                                .get('KAFKA_BROKER', 'localhost:9092')
                                .split(',');
                            console.log("\uD83D\uDD17 Kafka Config for [".concat(clientId, "]:"));
                            console.log('Brokers:', brokers);
                            console.log('Consumer Group:', consumerGroupId);
                            return {
                                transport: microservices_1.Transport.KAFKA,
                                options: {
                                    client: {
                                        clientId: clientId,
                                        brokers: brokers,
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
    };
    var EventModule_1;
    EventModule = EventModule_1 = __decorate([
        (0, common_1.Module)({})
    ], EventModule);
    return EventModule;
}());
exports.EventModule = EventModule;
