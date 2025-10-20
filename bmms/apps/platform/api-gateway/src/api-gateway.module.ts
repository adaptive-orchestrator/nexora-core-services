import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AuthModule } from './resources/auth/auth.module';
import { LlmOrchestratorModule } from './resources/llm-orchestrator/llm-orchestrator.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    LlmOrchestratorModule,
  ],
  controllers: [
    ApiGatewayController,
    // KHÔNG cần thêm AuthController và LlmOrchestratorController ở đây
    // vì chúng đã được declare trong AuthModule và LlmOrchestratorModule
  ],
  providers: [
    ApiGatewayService,
    // KHÔNG cần thêm LlmOrchestratorService ở đây
    // vì nó đã được declare trong LlmOrchestratorModule
  ],
})
export class ApiGatewayModule {}