"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbModule = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("@nestjs/typeorm");
var config_1 = require("@nestjs/config");
var DbModule = /** @class */ (function () {
    function DbModule() {
    }
    DbModule_1 = DbModule;
    DbModule.forRoot = function (options) {
        var prefix = options.prefix;
        return {
            module: DbModule_1,
            imports: [
                typeorm_1.TypeOrmModule.forRootAsync({
                    imports: [config_1.ConfigModule],
                    inject: [config_1.ConfigService],
                    useFactory: function (configService) {
                        // Tạo key với prefix: CUSTOMER_SVC_DB_HOST, ORDER_SVC_DB_HOST, ...
                        var host = configService.get("".concat(prefix, "_DB_HOST"));
                        var port = configService.get("".concat(prefix, "_DB_PORT"));
                        var username = configService.get("".concat(prefix, "_DB_USER"));
                        var password = configService.get("".concat(prefix, "_DB_PASS"));
                        var database = configService.get("".concat(prefix, "_DB_NAME"));
                        console.log("\uD83D\uDD0D DB Config for [".concat(prefix, "]:"));
                        console.log('Host:', host);
                        console.log('Port:', port);
                        console.log('User:', username);
                        console.log('Database:', database);
                        // Validate required fields
                        if (!host || !username || !password || !database) {
                            throw new Error("Missing database configuration for ".concat(prefix, ". ") +
                                "Please check your .env file for: ".concat(prefix, "_DB_HOST, ").concat(prefix, "_DB_USER, ").concat(prefix, "_DB_PASS, ").concat(prefix, "_DB_NAME"));
                        }
                        return {
                            type: 'mysql',
                            host: host,
                            port: parseInt(port || '3306', 10),
                            username: username,
                            password: password,
                            database: database,
                            autoLoadEntities: true,
                            synchronize: true, // ⚠️ CHỈ dùng trong development, tắt đi ở production!
                            logging: process.env.NODE_ENV === 'development', // Chỉ log khi dev
                        };
                    },
                }),
            ],
            exports: [typeorm_1.TypeOrmModule],
        };
    };
    var DbModule_1;
    DbModule = DbModule_1 = __decorate([
        (0, common_1.Module)({})
    ], DbModule);
    return DbModule;
}());
exports.DbModule = DbModule;
