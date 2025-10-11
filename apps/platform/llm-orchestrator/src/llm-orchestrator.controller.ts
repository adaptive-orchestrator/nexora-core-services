import { Controller, Get } from '@nestjs/common';
import { llmOrchestratorService } from './llm-orchestrator.service';

@Controller()
export class llmOrchestratorController {
  constructor(private readonly llmOrchestratorService: llmOrchestratorService) {}

  @Get()
  getHello(): string {
    return this.llmOrchestratorService.getHello();
  }
}
