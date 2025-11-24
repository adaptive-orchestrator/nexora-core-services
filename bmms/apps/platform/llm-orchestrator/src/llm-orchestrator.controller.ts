// @ts-nocheck - Disable TypeScript strict checking for NestJS decorators
import { Body, Controller, Get, Post, Query, Param } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import type { LlmChatRequest, LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';
import { K8sIntegrationService } from './service/k8s-integration.service';


@Controller()
export class LlmOrchestratorController {
  constructor(
    private readonly llmOrchestratorService: LlmOrchestratorService,
    private readonly codeSearchService: CodeSearchService,
    private readonly k8sIntegrationService: K8sIntegrationService,
  ) { }

  // @ts-ignore - NestJS decorator type issue in strict mode
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

  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'GenerateText')
  async generateText(data: { prompt: string; context?: any[] }): Promise<{ text: string }> {
    const { prompt, context } = data;

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt is required and must be a string');
    }

    const result = await this.llmOrchestratorService.generateText(prompt, context || []);
    return { text: result };
  }

  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'GenerateCode')
  async generateCode(data: { prompt: string; context?: any[] }): Promise<{ code: string; language: string; explanation: string }> {
    const { prompt, context } = data;

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt is required and must be a string');
    }

    const result = await this.llmOrchestratorService.generateCode(prompt, context || []);
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

  /**
   * Chat with LLM and auto-deploy to K8s
   * Query param: ?dryRun=true để chỉ sinh YAML không apply
   */
  @Post('/llm/chat-and-deploy')
  async chatAndDeploy(
    @Body() body: { message: string; tenant_id?: string; role?: string; lang?: 'vi' | 'en'; auto_deploy?: boolean },
    @Query('dryRun') dryRun?: string,
  ) {
    const isDryRun = dryRun === 'true';
    
    // 1. Get LLM response
    const llmResponse = await this.llmOrchestratorService.ask(
      body.message,
      body.tenant_id || 't-unknown',
      body.role || 'guest',
      body.lang || 'vi',
    );

    // 2. Auto-deploy if enabled
    let deploymentResult = null;
    if (body.auto_deploy !== false) {
      deploymentResult = await this.k8sIntegrationService.triggerDeployment(llmResponse, isDryRun);
    }

    return {
      llm: llmResponse,
      deployment: deploymentResult,
      mode: isDryRun ? 'DRY-RUN (YAML only)' : 'FULL (Applied to cluster)',
    };
  }

  /**
   * Check deployment status
   */
  @Get('/k8s/status/:namespace/:service')
  async getDeploymentStatus(
    @Param('namespace') namespace: string,
    @Param('service') service: string,
  ) {
    return this.k8sIntegrationService.checkDeploymentStatus(namespace, service);
  }
}
