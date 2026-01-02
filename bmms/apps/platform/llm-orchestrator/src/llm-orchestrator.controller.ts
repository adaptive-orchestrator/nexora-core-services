// @ts-nocheck - Disable TypeScript strict checking for NestJS decorators
import { Body, Controller, Get, Post, Query, Param, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import type { LlmChatRequest, LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';
import { HelmIntegrationService } from './service/helm-integration.service';
import { DynamicChangesetService } from './service/dynamic-changeset.service';
import type { DynamicChangesetGenerationRequest } from './service/dynamic-changeset.service';


@Controller()
export class LlmOrchestratorController {
  private readonly logger = new Logger(LlmOrchestratorController.name);

  constructor(
    private readonly llmOrchestratorService: LlmOrchestratorService,
    private readonly codeSearchService: CodeSearchService,
    private readonly helmIntegrationService: HelmIntegrationService,
    private readonly dynamicChangesetService: DynamicChangesetService,
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

    // ✅ METRIC: Start timing
    const startTotal = Date.now();
    
    // Get recommendation first (includes LLM call)
    const startLLM = Date.now();
    const recommendation = await this.llmOrchestratorService.recommendBusinessModel({
      business_description: businessDescription,
      target_audience: targetAudience,
      revenue_preference: revenuePreference,
      lang: data.lang,
    });
    const endLLM = Date.now();
    const llmTime = endLLM - startLLM;

    // Generate detailed changeset (includes validation)
    const startValidation = Date.now();
    const detailedChangeset = this.llmOrchestratorService.generateDetailedChangeset(
      currentModel,
      recommendation.recommended_model,
      businessDescription,
    );
    const endValidation = Date.now();
    const validationTime = endValidation - startValidation;
    
    const totalTime = Date.now() - startTotal;

    // ✅ METRIC: Log performance metrics
    console.log('[RecommendBusinessModelDetailed] ⏱️ METRICS:', {
      total_time_ms: totalTime,
      llm_generation_time_ms: llmTime,
      validation_processing_time_ms: validationTime,
    });

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
    helm_dry_run_results?: {
      validation_passed: boolean;
      databases_output: string;
      services_output: string;
      validation_errors: string[];
      warnings: string[];
    };
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
    // Trigger Helm deployment (with dry-run if requested)
    const result = await this.helmIntegrationService.triggerDeployment(
      mockLlmResponse,
      data.dry_run ?? false
    );

    this.logger.log(`[GRPC-SWITCH] Deployment result: success=${result.success}, deployed=${result.deployed}, dryRun=${result.dryRun}`);

    // Return response matching proto schema
    return {
      success: result.success,
      message: result.message || (result.success ? `Switched to ${data.to_model} model` : 'Switch failed'),
      changeset_path: result.changesetPath,
      deployed: result.deployed,
      dry_run: result.dryRun,
      error: result.error,
      helm_dry_run_results: result.helmDryRunResults ? {
        validation_passed: result.helmDryRunResults.validationPassed,
        databases_output: result.helmDryRunResults.databasesOutput,
        services_output: result.helmDryRunResults.servicesOutput,
        validation_errors: result.helmDryRunResults.validationErrors,
        warnings: result.helmDryRunResults.warnings,
      } : undefined,
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

  /**
   * REST API endpoint for RCA (Root Cause Analysis)
   * POST /rca
   * Body: { errorLog: string, question?: string }
   */
  @Post('/rca')
  async analyzeError(@Body() body: { errorLog: string; question?: string }) {
    if (!body.errorLog) {
      throw new Error('errorLog is required');
    }

    const result = await this.llmOrchestratorService.analyzeIncident(body.errorLog);

    return {
      success: result.success,
      analysis: result.analysis,
      codeContext: result.codeContext,
      error: result.error,
    };
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
      const result = await this.llmOrchestratorService.handleTextToSql(question);
      
      // Convert rawData array to JSON string for gRPC
      return {
        success: result.success,
        question: result.question,
        sql: result.sql || '',
        natural_response: result.naturalResponse || '',
        raw_data: result.rawData ? JSON.stringify(result.rawData) : '',
        error: result.error || '',
      };
    } catch (error) {
      console.error('[TextToSql gRPC] Error:', error);
      return {
        success: false,
        question,
        sql: '',
        natural_response: `Có lỗi xảy ra khi xử lý câu hỏi: ${error.message}`,
        raw_data: '',
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
      // Construct error log from incident description and logs
      const errorLog = `${incident_description}${logs ? `\n\nLogs:\n${logs}` : ''}`;

      // Use dedicated RCA method with proper schema validation
      const result = await this.llmOrchestratorService.analyzeIncident(errorLog);

      if (!result.success || !result.analysis) {
        return {
          severity: 'unknown',
          analysis: result.error || 'Unable to analyze incident',
          recommendations: [],
          raw_response: result.error || '',
        };
      }

      // Map RCA output to gRPC response format
      const analysis = result.analysis;
      
      return {
        severity: analysis.severity || 'medium',
        analysis: `${analysis.summary}\n\n**Root Cause:** ${analysis.root_cause}\n\n**Affected Component:** ${analysis.affected_component}\n\n**Suggested Fix:**\n${analysis.suggested_fix}\n\n**Prevention:** ${analysis.prevention}`,
        recommendations: [analysis.suggested_fix, analysis.prevention].filter(Boolean),
        raw_response: JSON.stringify(analysis),
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
  /**
   * NEW API: Generate Dynamic Changeset using RAG
   * POST /llm-orchestrator/generate-dynamic-changeset
   * 
   * Uses RAG to discover services and generate changeset files
   * WITH optional Helm validation and deployment
   */
  @Post('generate-dynamic-changeset')
  async generateDynamicChangeset(
    @Body() request: DynamicChangesetGenerationRequest,
  ) {
    try {
      console.log('[DynamicChangeset API] Request:', request);

      // Validate input
      if (!request.user_intent || request.user_intent.trim() === '') {
        return {
          success: false,
          error: 'user_intent is required',
        };
      }

      // Generate changeset using RAG (with optional validation and deployment)
      const result = await this.dynamicChangesetService.generateDynamicChangeset(request);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          helm_validation: result.helm_validation,
          fallback_available: result.fallback_available,
          fallback_models: result.fallback_models,
        };
      }

      // Return paths to generated files
      return {
        success: true,
        message: result.deployed 
          ? 'Dynamic changeset generated, validated, and deployed successfully'
          : result.helm_validation?.validation_passed
            ? 'Dynamic changeset generated and validated successfully (Helm dry-run PASSED)'
            : 'Dynamic changeset generated successfully (FILES ONLY - Helm NOT executed)',
        data: {
          changeset: result.changeset,
          files: {
            json: result.jsonPath,
            yaml: result.yamlPath,
          },
          discovered_services: result.changeset?.discovered_services || [],
          risk_level: result.changeset?.risk_level || 'unknown',
          total_services: result.changeset?.services.length || 0,
          enabled_services: result.changeset?.services.filter(s => s.enabled).length || 0,
        },
        helm_validation: result.helm_validation,
        deployed: result.deployed,
        fallback_available: result.fallback_available,
        fallback_models: result.fallback_models,
      };
    } catch (error) {
      console.error('[DynamicChangeset API] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        fallback_available: true,
        fallback_models: ['retail', 'subscription', 'freemium', 'multi'],
      };
    }
  }

  /**
   * gRPC Method: GenerateDynamicChangeset
   * Generate dynamic changeset with RAG, optional Helm validation and deployment
   */
  // @ts-ignore - NestJS decorator type issue in strict mode
  @GrpcMethod('LlmOrchestratorService', 'GenerateDynamicChangeset')
  async generateDynamicChangesetGrpc(data: {
    user_intent: string;
    current_model?: string;
    target_model?: string;
    force_services?: string[];
    exclude_services?: string[];
    dry_run?: boolean;
    deploy_after_validation?: boolean;
    tenant_id?: string;
  }): Promise<{
    success: boolean;
    message: string;
    error?: string;
    changeset?: {
      timestamp: string;
      intent: string;
      from_model?: string;
      to_model?: string;
      discovered_services: string[];
      services: Array<{
        name: string;
        enabled: boolean;
        replica_count?: number;
        needs_restart?: boolean;
        confidence?: number;
      }>;
      risk_level: string;
      auto_generated: boolean;
    };
    json_path?: string;
    yaml_path?: string;
    helm_validation?: {
      validation_passed: boolean;
      databases_output?: string;
      services_output?: string;
      validation_errors: string[];
      warnings: string[];
    };
    deployed?: boolean;
    fallback_available?: boolean;
    fallback_models?: string[];
  }> {
    this.logger.log(`[GRPC-DynamicChangeset] Received request: intent="${data.user_intent?.substring(0, 50)}..."`);
    this.logger.log(`[GRPC-DynamicChangeset] Options: dry_run=${data.dry_run}, deploy=${data.deploy_after_validation}`);

    if (!data.user_intent || data.user_intent.trim() === '') {
      return {
        success: false,
        message: 'Validation failed',
        error: 'user_intent is required',
        fallback_available: true,
        fallback_models: ['retail', 'subscription', 'freemium', 'multi'],
      };
    }

    try {
      const result = await this.dynamicChangesetService.generateDynamicChangeset({
        user_intent: data.user_intent,
        current_model: data.current_model,
        target_model: data.target_model,
        force_services: data.force_services || [],
        exclude_services: data.exclude_services || [],
        dry_run: data.dry_run ?? true,
        deploy_after_validation: data.deploy_after_validation ?? false,
        tenant_id: data.tenant_id || 'default',
      });

      if (!result.success) {
        return {
          success: false,
          message: 'Generation failed',
          error: result.error,
          helm_validation: result.helm_validation ? {
            validation_passed: result.helm_validation.validation_passed,
            databases_output: result.helm_validation.databases_output,
            services_output: result.helm_validation.services_output,
            validation_errors: result.helm_validation.validation_errors,
            warnings: result.helm_validation.warnings,
          } : undefined,
          fallback_available: result.fallback_available,
          fallback_models: result.fallback_models,
        };
      }

      return {
        success: true,
        message: result.deployed
          ? 'Dynamic changeset generated, validated, and deployed'
          : result.helm_validation?.validation_passed
            ? 'Dynamic changeset generated and validated (dry-run passed)'
            : 'Dynamic changeset generated (files only)',
        changeset: result.changeset ? {
          timestamp: result.changeset.timestamp,
          intent: result.changeset.intent,
          from_model: result.changeset.from_model,
          to_model: result.changeset.to_model,
          discovered_services: result.changeset.discovered_services,
          services: result.changeset.services.map(s => ({
            name: s.name,
            enabled: s.enabled,
            replica_count: s.replicaCount,
            needs_restart: s.needsRestart,
            confidence: s.confidence,
          })),
          risk_level: result.changeset.risk_level,
          auto_generated: result.changeset.auto_generated,
        } : undefined,
        json_path: result.jsonPath,
        yaml_path: result.yamlPath,
        helm_validation: result.helm_validation ? {
          validation_passed: result.helm_validation.validation_passed,
          databases_output: result.helm_validation.databases_output,
          services_output: result.helm_validation.services_output,
          validation_errors: result.helm_validation.validation_errors,
          warnings: result.helm_validation.warnings,
        } : undefined,
        deployed: result.deployed,
        fallback_available: result.fallback_available,
        fallback_models: result.fallback_models,
      };
    } catch (error: any) {
      this.logger.error(`[GRPC-DynamicChangeset] Error: ${error.message}`);
      return {
        success: false,
        message: 'Internal error',
        error: error.message,
        fallback_available: true,
        fallback_models: ['retail', 'subscription', 'freemium', 'multi'],
      };
    }
  }
}
