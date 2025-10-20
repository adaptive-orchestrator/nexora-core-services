import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { LlmChatRequestDto } from './llm-orchestrator/dto/llm-chat-request.dto';
import { LlmChatResponseDto } from './llm-orchestrator/dto/response.dto';
import type { LlmChatRequest, LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';


@Controller()
export class LlmOrchestratorController {
  constructor(
    private readonly llmOrchestratorService: LlmOrchestratorService,
  ) {}

  @GrpcMethod('LlmOrchestratorService', 'ChatOnce')
  async chatOnce(data: LlmChatRequest): Promise<LlmChatResponse> {
    const { message, tenant_id, role, lang } = data;

    // Validate message
    if (!message || typeof message !== 'string') {
      throw new Error('message is required and must be a string');
    }

    const result = await this.llmOrchestratorService.ask(
      message,
      tenant_id || 't-unknown',
      role || 'guest',
      (lang as 'vi' | 'en') || 'vi',
    );

    return result;
  }
}