import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import type { LlmChatRequest, LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';


@Controller()
export class LlmOrchestratorController {
  constructor(
    private readonly llmOrchestratorService: LlmOrchestratorService,
    private readonly codeSearchService: CodeSearchService,
  ) { }

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
  @Get('/rag/health')
  async ragHealth() {
    const result = await this.codeSearchService.healthCheck();
    return result;
  }

  @Post('/rag/search')
  async ragSearch(@Body() body: { query: string; limit?: number }) {
    const results = await this.codeSearchService.searchRelevantCode(
      body.query,
      body.limit || 3
    );
    return { query: body.query, results };
  }
  @Get('/rag/all')
  async ragGetAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.codeSearchService.getAllEmbeddings(
      parseInt(limit || '100'),
      parseInt(offset || '0'),
    );
    return result;
  }

  @Get('/rag/stats')
  async ragStats() {
    const stats = await this.codeSearchService.getStats();
    return stats;
  }
}