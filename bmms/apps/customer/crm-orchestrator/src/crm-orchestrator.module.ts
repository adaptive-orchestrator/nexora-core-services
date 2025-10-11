import { Module } from '@nestjs/common';
import { crmOrchestratorController } from './crm-orchestrator.controller';
import { crmOrchestratorService } from './crm-orchestrator.service';

@Module({
  imports: [],
  controllers: [crmOrchestratorController],
  providers: [crmOrchestratorService],
})
export class crmOrchestratorModule {}
