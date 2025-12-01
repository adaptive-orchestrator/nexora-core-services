import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { debug } from '@bmms/common';

export interface DbModuleOptions {
  prefix: string; // Prefix cho env variables (vd: CUSTOMER_SVC, ORDER_SVC)
}

@Module({})
export class DbModule {
  static forRoot(options: DbModuleOptions): DynamicModule {
    const { prefix } = options;
    
    return {
      module: DbModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            // Tạo key với prefix: CUSTOMER_SVC_DB_HOST, ORDER_SVC_DB_HOST, ...
            const host = configService.get(`${prefix}_DB_HOST`);
            const port = configService.get(`${prefix}_DB_PORT`);
            const username = configService.get(`${prefix}_DB_USER`);
            const password = configService.get(`${prefix}_DB_PASS`);
            const database = configService.get(`${prefix}_DB_NAME`);
            
            debug.log(`🔍 DB Config for [${prefix}]:`);
            debug.log('Host:', host);
            debug.log('Port:', port);
            debug.log('User:', username);
            debug.log('Database:', database);
            
            // Validate required fields
            if (!host || !username || !password || !database) {
              throw new Error(
                `Missing database configuration for ${prefix}. ` +
                `Please check your .env file for: ${prefix}_DB_HOST, ${prefix}_DB_USER, ${prefix}_DB_PASS, ${prefix}_DB_NAME`
              );
            }
            
            return {
              type: 'mysql' as const,
              host,
              port: parseInt(port || '3306', 10),
              username,
              password,
              database,
              autoLoadEntities: true,
              synchronize: true, // ⚠️ CHỈ dùng trong development, tắt đi ở production!
              logging: false, // 🚀 Disable logging for performance
              // 🚀 Connection Pool Optimization for High Concurrency (1000 VUs)
              extra: {
                connectionLimit: 100,       // Giữ 100 (đủ cho 1 service)
                waitForConnections: true,
                queueLimit: 1000,           // Tăng queue lên 1000 để buffer requests
                enableKeepAlive: true,
                keepAliveInitialDelay: 10000,
                acquireTimeout: 120000,     // 120s timeout
                timeout: 120000,
                maxIdle: 50,                // Keep 50 idle connections
                idleTimeout: 60000,
                connectTimeout: 60000,      // Connection timeout
              },
              // 🚀 Query Cache (Extended)
              cache: {
                duration: 60000, // Cache queries 60 seconds
              },
              // 🚀 Retry Strategy
              retryAttempts: 5,             // Tăng từ 3 lên 5
              retryDelay: 2000,             // Tăng delay lên 2s
            };
          },
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}