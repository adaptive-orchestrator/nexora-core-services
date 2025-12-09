// @ts-nocheck - Disable TypeScript strict checking for NestJS decorators
import { Body, Controller, Get, Post, Query, Param } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import type { LlmChatRequest, LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';
import { HelmIntegrationService } from './service/helm-integration.service';


@Controller()
export class LlmOrchestratorController {
  constructor(
    private readonly llmOrchestratorService: LlmOrchestratorService,
    private readonly codeSearchService: CodeSearchService,
    private readonly helmIntegrationService: HelmIntegrationService,
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

  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'RecommendBusinessModel')
  async recommendBusinessModel(data: {
    business_description?: string;
    businessDescription?: string; // gRPC may convert snake_case to camelCase
    target_audience?: string;
    targetAudience?: string;
    revenue_preference?: string;
    revenuePreference?: string;
    lang?: string;
  }): Promise<{
    greeting: string;
    recommendation_intro: string;
    recommended_model: string;
    why_this_fits: string;
    how_it_works: string;
    next_steps: string[];
    alternatives_intro?: string;
    alternatives?: Array<{ model: string; brief_reason: string }>;
    closing?: string;
  }> {
    // Handle both snake_case and camelCase (gRPC may convert)
    const businessDescription = data.business_description || data.businessDescription;
    const targetAudience = data.target_audience || data.targetAudience;
    const revenuePreference = data.revenue_preference || data.revenuePreference;
    
    console.log('[RecommendBusinessModel] Received data:', JSON.stringify(data));
    
    if (!businessDescription || typeof businessDescription !== 'string') {
      throw new Error('business_description is required and must be a string');
    }

    return this.llmOrchestratorService.recommendBusinessModel({
      business_description: businessDescription,
      target_audience: targetAudience,
      revenue_preference: revenuePreference,
      lang: data.lang,
    });
  }

  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'SwitchBusinessModel')
  async switchBusinessModel(data: {
    to_model: string;
    tenant_id?: string;
    dry_run?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    changeset_path?: string;
    deployed?: boolean;
    dry_run?: boolean;
    error?: string;
  }> {
    const validModels = ['retail', 'subscription', 'freemium', 'multi'];
    if (!data.to_model || !validModels.includes(data.to_model)) {
      throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
    }

    // Tạo mock LLM response để generate changeset
    const mockLlmResponse = {
      metadata: {
        to_model: data.to_model,
      },
      changeset: {
        features: [
          { key: 'business_model', value: data.to_model },
        ],
      },
    };

    // Trigger Helm deployment
    const result = await this.helmIntegrationService.triggerDeployment(
      mockLlmResponse, 
      data.dry_run ?? false
    );

    return {
      success: result.success,
      message: result.message || (result.success ? `Switched to ${data.to_model} model` : 'Switch failed'),
      changeset_path: result.changesetPath,
      deployed: result.deployed,
      dry_run: result.dryRun,
      error: result.error,
    };
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
      deploymentResult = await this.helmIntegrationService.triggerDeployment(llmResponse, isDryRun);
    }

    return {
      llm: llmResponse,
      deployment: deploymentResult,
      mode: isDryRun ? 'DRY-RUN (YAML only)' : 'FULL (Applied to cluster)',
    };
  }

  /**
   * Check Helm release status
   */
  @Get('/helm/status/:namespace/:release')
  async getHelmStatus(
    @Param('namespace') namespace: string,
    @Param('release') release: string,
  ) {
    return this.helmIntegrationService.getHelmStatus(release, namespace);
  }

  /**
   * List all Helm releases
   */
  @Get('/helm/releases')
  async listHelmReleases() {
    return this.helmIntegrationService.listHelmReleases();
  }

  /**
   * Get Helm configuration (for debugging)
   * Returns configured paths for helm charts and changesets
   */
  @Get('/helm/config')
  getHelmConfiguration() {
    return this.helmIntegrationService.getConfiguration();
  }
}
