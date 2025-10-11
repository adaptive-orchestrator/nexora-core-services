import { Controller, Get } from '@nestjs/common';
import { crmOrchestratorService } from './crm-orchestrator.service';

@Controller()
export class crmOrchestratorController {
  constructor(private readonly crmOrchestratorService: crmOrchestratorService) {}

  @Get()
  getHello(): string {
    return this.crmOrchestratorService.getHello();
  }
}
