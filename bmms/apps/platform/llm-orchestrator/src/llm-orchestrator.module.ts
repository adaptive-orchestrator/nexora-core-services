import { Module, OnModuleInit } from '@nestjs/common';
import { LlmOrchestratorController } from './llm-orchestrator.controller';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CodeSearchService } from './service/code-search.service';
import { HelmIntegrationService } from './service/helm-integration.service';
import { LlmOutputValidator } from './validators/llm-output.validator';
import { EventModule } from '@bmms/event';
import { ModuleRef } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // TypeORM for Text-to-SQL feature (optional)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        const textToSqlEnabled = configService.get<string>('TEXT_TO_SQL_ENABLED') === 'true';
        
        // Only connect if Text-to-SQL is enabled and DB URL is provided
        if (!textToSqlEnabled || !dbUrl) {
          return {
            type: 'postgres',
            synchronize: false,
            autoLoadEntities: false,
            // Return a dummy config that won't connect
            host: '',
            port: 5432,
            database: '',
            username: '',
            password: '',
          } as any;
        }

        return {
          type: 'postgres',
          url: dbUrl,
          synchronize: false,
          autoLoadEntities: true,
          logging: configService.get<string>('DB_LOGGING') === 'true',
        };
      },
    }),
    
    // Kafka Event Module
    EventModule.forRoot({
      clientId: 'llm-orchestrator',
      consumerGroupId: 'llm-orchestrator-group',
    }),
    
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<number>('TOKEN_EXPIRE_TIME')
        },
      }),
    }),
  ],
  controllers: [LlmOrchestratorController],
  providers: [LlmOrchestratorService, CodeSearchService, HelmIntegrationService, LlmOutputValidator],
  exports: [LlmOrchestratorService],
})
export class LlmOrchestratorModule implements OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    private llmService: LlmOrchestratorService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Inject DataSource if Text-to-SQL is enabled
    const textToSqlEnabled = this.configService.get<string>('TEXT_TO_SQL_ENABLED') === 'true';
    
    if (textToSqlEnabled) {
      try {
        const dataSource = this.moduleRef.get(DataSource, { strict: false });
        if (dataSource && dataSource.isInitialized) {
          this.llmService.setDataSource(dataSource);
          console.log('[LLM Module] DataSource injected for Text-to-SQL');
        }
      } catch (error) {
        console.warn('[LLM Module] DataSource not available:', error);
      }
    }
  }
}
