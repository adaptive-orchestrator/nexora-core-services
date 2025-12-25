// @ts-nocheck - Disable TypeScript strict checking for NestJS decorators
import { Body, Controller, Get, Post, Query, Param, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import type { LlmChatRequest, LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';
import { HelmIntegrationService } from './service/helm-integration.service';


@Controller()
export class LlmOrchestratorController {
  private readonly logger = new Logger(LlmOrchestratorController.name);

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
  @GrpcMethod('LlmOrchestratorService', 'RecommendBusinessModelDetailed')
  async recommendBusinessModelDetailed(data: {
    business_description?: string;
    businessDescription?: string;
    current_model?: string;
    currentModel?: string;
    target_audience?: string;
    targetAudience?: string;
    revenue_preference?: string;
    revenuePreference?: string;
    lang?: string;
  }): Promise<{
    proposal_text: string;
    changeset: {
      model: string;
      features: Array<{ key: string; value: string }>;
      impacted_services: string[];
      services_to_enable: string[];
      services_to_disable: string[];
      services_to_restart: string[];
    };
    metadata: {
      intent: string;
      confidence: number;
      risk: string;
      from_model: string;
      to_model: string;
    };
  }> {
    const businessDescription = data.business_description || data.businessDescription;
    const currentModel = data.current_model || data.currentModel || 'retail';
    const targetAudience = data.target_audience || data.targetAudience;
    const revenuePreference = data.revenue_preference || data.revenuePreference;
    
    console.log('[RecommendBusinessModelDetailed] Received data:', JSON.stringify(data));
    
    if (!businessDescription || typeof businessDescription !== 'string') {
      throw new Error('business_description is required and must be a string');
    }

    // Get recommendation first
    const recommendation = await this.llmOrchestratorService.recommendBusinessModel({
      business_description: businessDescription,
      target_audience: targetAudience,
      revenue_preference: revenuePreference,
      lang: data.lang,
    });

    // Generate detailed changeset
    const detailedChangeset = this.llmOrchestratorService.generateDetailedChangeset(
      currentModel,
      recommendation.recommended_model,
      businessDescription,
    );

    return {
      proposal_text: recommendation.why_this_fits || recommendation.recommendation_intro,
      changeset: detailedChangeset.changeset,
      metadata: detailedChangeset.metadata,
    };
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
    this.logger.log(`[GRPC-SWITCH] Received request: to_model=${data.to_model}, tenant=${data.tenant_id}, dry_run=${data.dry_run}`);

    const validModels = ['retail', 'subscription', 'freemium', 'multi'];
    if (!data.to_model || !validModels.includes(data.to_model)) {
      this.logger.error(`[GRPC-SWITCH] Invalid model: ${data.to_model}`);
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

    this.logger.log(`[GRPC-SWITCH] Calling helmIntegrationService.triggerDeployment...`);
    // Trigger Helm deployment
    const result = await this.helmIntegrationService.triggerDeployment(
      mockLlmResponse,
      data.dry_run ?? false
    );

    this.logger.log(`[GRPC-SWITCH] Deployment result: success=${result.success}, deployed=${result.deployed}, dryRun=${result.dryRun}`);

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

  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'TextToSql')
  async textToSql(data: { question: string; lang?: string }) {
    const { question, lang } = data;

    if (!question || typeof question !== 'string') {
      throw new Error('question is required and must be a string');
    }

    try {
      return await this.llmOrchestratorService.handleTextToSql(question);
    } catch (error) {
      console.error('[TextToSql gRPC] Error:', error);
      return {
        success: false,
        question,
        naturalResponse: `Có lỗi xảy ra khi xử lý câu hỏi: ${error.message}`,
        error: error.message || 'Unknown error',
      };
    }
  }

  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'AnalyzeIncident')
  async analyzeIncident(data: { incident_description: string; logs?: string; lang?: string }) {
    const { incident_description, logs, lang } = data;

    if (!incident_description || typeof incident_description !== 'string') {
      throw new Error('incident_description is required and must be a string');
    }

    try {
      // For now, use the generic ask method with a specialized prompt
      const prompt = `Analyze this system incident and provide recommendations:

Incident: ${incident_description}
${logs ? `\nLogs:\n${logs}` : ''}

Please analyze and provide:
1. Severity level (low/medium/high/critical)
2. Possible root cause
3. Immediate actions to take
4. Long-term recommendations

Respond in ${lang === 'en' ? 'English' : 'Vietnamese'}.`;

      const result = await this.llmOrchestratorService.ask(
        prompt,
        't-system',
        'admin',
        (lang as 'vi' | 'en') || 'vi',
      );

      // Parse the response to extract structured data
      return {
        severity: 'medium', // Could be parsed from LLM response
        analysis: result.proposal_text || result.response || result.text || JSON.stringify(result),
        recommendations: [], // Could be parsed from LLM response
        raw_response: JSON.stringify(result),
      };
    } catch (error) {
      console.error('[AnalyzeIncident gRPC] Error:', error);
      return {
        severity: 'unknown',
        analysis: `Có lỗi xảy ra khi phân tích sự cố: ${error.message}`,
        recommendations: [],
        raw_response: error.message,
      };
    }
  }
}
