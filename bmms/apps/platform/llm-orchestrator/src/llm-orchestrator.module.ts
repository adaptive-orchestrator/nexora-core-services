import { Module, OnModuleInit, DynamicModule } from '@nestjs/common';
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

@Module({})
export class LlmOrchestratorModule implements OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    private llmService: LlmOrchestratorService,
    private configService: ConfigService,
  ) {}

  static forRoot(): DynamicModule {
    const textToSqlEnabled = process.env.TEXT_TO_SQL_ENABLED === 'true';
    const imports: any[] = [
      ConfigModule.forRoot({
        isGlobal: true,
      }),
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
    ];

    // Only import TypeORM if Text-to-SQL is enabled
    if (textToSqlEnabled) {
      imports.push(
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const dbUrl = configService.get<string>('DATABASE_URL');
            
            if (!dbUrl) {
              throw new Error('DATABASE_URL is required when TEXT_TO_SQL_ENABLED=true');
            }

            return {
              type: 'mysql',
              url: dbUrl,
              synchronize: false,
              autoLoadEntities: true,
              logging: configService.get<string>('DB_LOGGING') === 'true',
            };
          },
        })
      );
    }

    return {
      module: LlmOrchestratorModule,
      imports,
      controllers: [LlmOrchestratorController],
      providers: [LlmOrchestratorService, CodeSearchService, HelmIntegrationService, LlmOutputValidator],
      exports: [LlmOrchestratorService],
    };
  }

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
