import { Module } from '@nestjs/common';

import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getLlmGrpcClientOptions } from '../../client-options/llm-orchestrator.grpc-client';
import { LlmOrchestratorController } from './llm-orchestrator.controller';
import { LlmOrchestratorService } from './llm-orchestrator.service';


@Module({
  imports: [
    ConfigModule.forRoot({
          isGlobal: true,
        }),
    ClientsModule.registerAsync([
      {
        name: 'LLM_PACKAGE',
        imports: [ConfigModule],
        useFactory: getLlmGrpcClientOptions,
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [LlmOrchestratorController],
  providers: [LlmOrchestratorService],
  exports: [LlmOrchestratorService],
})
export class LlmOrchestratorModule { }
