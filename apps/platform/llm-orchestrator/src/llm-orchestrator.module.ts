import { Module } from '@nestjs/common';
import { llmOrchestratorController } from './llm-orchestrator.controller';
import { llmOrchestratorService } from './llm-orchestrator.service';

@Module({
  imports: [],
  controllers: [llmOrchestratorController],
  providers: [llmOrchestratorService],
})
export class llmOrchestratorModule {}
