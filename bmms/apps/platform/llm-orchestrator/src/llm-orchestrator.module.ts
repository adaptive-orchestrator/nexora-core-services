import { Module, OnModuleInit, DynamicModule } from '@nestjs/common';
import { LlmOrchestratorController } from './llm-orchestrator.controller';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CodeSearchService } from './service/code-search.service';
import { HelmIntegrationService } from './service/helm-integration.service';
import { DynamicChangesetService } from './service/dynamic-changeset.service';
import { LlmOutputValidator } from './validators/llm-output.validator';
import { EventModule } from '@bmms/event';
import { ModuleRef } from '@nestjs/core';
import { MultiDatabaseService } from './service/multi-database.service';

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

    // Note: We'll create DataSource connections programmatically in the service
    // instead of using TypeOrmModule.forRootAsync for better standalone mode support

    return {
      module: LlmOrchestratorModule,
      imports,
      controllers: [LlmOrchestratorController],
      providers: [
        LlmOrchestratorService, 
        CodeSearchService, 
        HelmIntegrationService,
        DynamicChangesetService,
        LlmOutputValidator,
        MultiDatabaseService,
      ],
      exports: [LlmOrchestratorService],
    };
  }

  async onModuleInit() {
    // Initialize database connections if Text-to-SQL is enabled
    const textToSqlEnabled = this.configService.get<string>('TEXT_TO_SQL_ENABLED') === 'true';
    
    if (textToSqlEnabled) {
      console.log('[LLM Module] Text-to-SQL enabled - initializing database connections...');
      await this.llmService.initializeDatabaseConnections();
    }
  }
}
