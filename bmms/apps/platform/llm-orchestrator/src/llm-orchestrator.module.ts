import { Module } from '@nestjs/common';
import { LlmOrchestratorController } from './llm-orchestrator.controller';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CodeSearchService } from './service/code-search.service';
import { HelmIntegrationService } from './service/helm-integration.service';
import { LlmOutputValidator } from './validators/llm-output.validator';
import { EventModule } from '@bmms/event';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
})
export class LlmOrchestratorModule { }
