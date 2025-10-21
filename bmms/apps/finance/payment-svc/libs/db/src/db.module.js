"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DbModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
let DbModule = DbModule_1 = class DbModule {
    static forRoot(options) {
        const { prefix } = options;
        return {
            module: DbModule_1,
            imports: [
                typeorm_1.TypeOrmModule.forRootAsync({
                    imports: [config_1.ConfigModule],
                    inject: [config_1.ConfigService],
                    useFactory: (configService) => {
                        const host = configService.get(`${prefix}_DB_HOST`);
                        const port = configService.get(`${prefix}_DB_PORT`);
                        const username = configService.get(`${prefix}_DB_USER`);
                        const password = configService.get(`${prefix}_DB_PASS`);
                        const database = configService.get(`${prefix}_DB_NAME`);
                        console.log(`🔍 DB Config for [${prefix}]:`);
                        console.log('Host:', host);
                        console.log('Port:', port);
                        console.log('User:', username);
                        console.log('Database:', database);
                        if (!host || !username || !password || !database) {
                            throw new Error(`Missing database configuration for ${prefix}. ` +
                                `Please check your .env file for: ${prefix}_DB_HOST, ${prefix}_DB_USER, ${prefix}_DB_PASS, ${prefix}_DB_NAME`);
                        }
                        return {
                            type: 'mysql',
                            host,
                            port: parseInt(port || '3306', 10),
                            username,
                            password,
                            database,
                            autoLoadEntities: true,
                            synchronize: true,
                            logging: process.env.NODE_ENV === 'development',
                        };
                    },
                }),
            ],
            exports: [typeorm_1.TypeOrmModule],
        };
    }
};
exports.DbModule = DbModule;
exports.DbModule = DbModule = DbModule_1 = __decorate([
    (0, common_1.Module)({})
], DbModule);
//# sourceMappingURL=db.module.js.map