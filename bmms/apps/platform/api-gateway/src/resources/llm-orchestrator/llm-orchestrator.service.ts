// api-gateway/src/resources/llm-orchestrator/llm-orchestrator.service.ts
import { Injectable, OnModuleInit, Inject, HttpException, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';

interface LlmOrchestratorGrpcService {
  chatOnce(data: {
    message: string;
    tenant_id: string;
    role: string;
    lang: string;
  }): any;
  recommendBusinessModel(data: {
    business_description: string;
    target_audience?: string;
    revenue_preference?: string;
    lang?: string;
  }): any;
  recommendBusinessModelDetailed(data: {
    business_description: string;
    current_model: string;
    target_audience?: string;
    revenue_preference?: string;
    lang?: string;
  }): any;
  switchBusinessModel(data: {
    to_model: string;
    tenant_id: string;
    dry_run: boolean;
  }): any;
  textToSql(data: {
    question: string;
    lang?: string;
  }): any;
  analyzeIncident(data: {
    incident_description: string;
    logs?: string;
    lang?: string;
  }): any;
  generateDynamicChangeset(data: {
    user_intent: string;
    current_model?: string;
    target_model?: string;
    force_services?: string[];
    exclude_services?: string[];
    dry_run?: boolean;
    deploy_after_validation?: boolean;
    tenant_id?: string;
  }): any;
}

export interface RecommendModelResponse {
  greeting: string;
  recommendation_intro: string;
  recommended_model: string;
  why_this_fits: string;
  how_it_works: string;
  next_steps: string[];
  alternatives_intro?: string;
  alternatives?: Array<{ model: string; brief_reason: string }>;
  closing?: string;
}

export interface SwitchModelResponse {
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
}

export interface DynamicChangesetResponse {
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
}

@Injectable()
export class LlmOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(LlmOrchestratorService.name);
  private llmGrpcService: LlmOrchestratorGrpcService;

  constructor(
    @Inject('LLM_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.llmGrpcService = this.client.getService<LlmOrchestratorGrpcService>('LlmOrchestratorService');
  }

  async ask(
    message: string,
    tenant_id?: string,
    role?: string,
    lang: string = 'vi',
  ) {
    if (!message || typeof message !== 'string') {
      throw new BadRequestException('message required');
    }

    const start = Date.now();
    this.logger.log(
      `[ASK] tenant=${tenant_id ?? '-'} | role=${role ?? '-'} | lang=${lang} | message="${message}"`,
    );

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.chatOnce({
          message,
          tenant_id: tenant_id || 't-unknown',
          role: role || 'guest',
          lang: lang || 'vi',
        }).pipe(
          catchError(error => {
            this.logger.error(`[ASK-ERROR] gRPC error: ${error.details || error.message}`);
            if (error.details === 'Invalid message format') {
              throw new HttpException('Invalid message format', HttpStatus.BAD_REQUEST);
            }
            if (error.details && error.details.includes('LLM')) {
              throw new HttpException(error.details, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            throw new HttpException(error.details || 'LLM request failed', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );

      const elapsed = Date.now() - start;
      this.logger.log(`[ASK-DONE] took ${elapsed}ms | tenant=${tenant_id ?? '-'}`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[ASK-ERROR] Service unavailable: ${error.message}`, error.stack);
      throw new HttpException('LLM Orchestrator service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Tư vấn mô hình kinh doanh với detailed changeset
   */
  async recommendBusinessModelDetailed(
    business_description: string,
    current_model: string,
    target_audience?: string,
    revenue_preference?: string,
    lang: string = 'vi',
  ): Promise<{
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
      risk: 'low' | 'medium' | 'high';
      from_model: string;
      to_model: string;
    };
  }> {
    if (!business_description) {
      throw new BadRequestException('business_description is required');
    }

    const start = Date.now();
    this.logger.log(`[RECOMMEND-DETAILED] business="${business_description.substring(0, 50)}..." | current=${current_model}`);

    // Build gRPC request payload
    const grpcPayload = {
      business_description: business_description,
      businessDescription: business_description,
      current_model: current_model,
      currentModel: current_model,
      target_audience: target_audience,
      targetAudience: target_audience,
      revenue_preference: revenue_preference,
      revenuePreference: revenue_preference,
      lang: lang,
    };
    
    this.logger.log(`[RECOMMEND-DETAILED] Sending gRPC payload: ${JSON.stringify(grpcPayload)}`);

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.recommendBusinessModelDetailed(grpcPayload).pipe(
          catchError(error => {
            this.logger.error(`[RECOMMEND-DETAILED-ERROR] gRPC error: ${error.details || error.message}`);
            throw new HttpException(error.details || 'Detailed recommendation failed', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      ) as {
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
          risk: 'low' | 'medium' | 'high';
          from_model: string;
          to_model: string;
        };
      };

      const elapsed = Date.now() - start;
      this.logger.log(`[RECOMMEND-DETAILED-DONE] took ${elapsed}ms | ${response.metadata?.from_model} → ${response.metadata?.to_model}`);
      this.logger.log(`[RECOMMEND-DETAILED] Response: ${JSON.stringify(response, null, 2)}`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[RECOMMEND-DETAILED-ERROR] Service unavailable: ${error.message}`, error.stack);
      throw new HttpException('LLM Orchestrator service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Tư vấn mô hình kinh doanh phù hợp
   */
  async recommendBusinessModel(
    business_description: string,
    target_audience?: string,
    revenue_preference?: string,
    lang: string = 'vi',
  ): Promise<RecommendModelResponse> {
    if (!business_description || typeof business_description !== 'string') {
      throw new BadRequestException('business_description is required');
    }

    const start = Date.now();
    this.logger.log(`[RECOMMEND] business="${business_description.substring(0, 50)}..." | lang=${lang}`);

    // Build gRPC request payload
    const grpcPayload = {
      business_description: business_description,
      businessDescription: business_description, // Also send camelCase version
      target_audience: target_audience,
      targetAudience: target_audience,
      revenue_preference: revenue_preference,
      revenuePreference: revenue_preference,
      lang: lang,
    };
    
    this.logger.log(`[RECOMMEND] Sending gRPC payload: ${JSON.stringify(grpcPayload)}`);

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.recommendBusinessModel(grpcPayload).pipe(
          catchError(error => {
            this.logger.error(`[RECOMMEND-ERROR] gRPC error: ${error.details || error.message}`);
            throw new HttpException(error.details || 'Recommendation failed', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      ) as RecommendModelResponse;

      const elapsed = Date.now() - start;
      this.logger.log(`[RECOMMEND-DONE] took ${elapsed}ms | model=${response.recommended_model}`);
      this.logger.log(`[RECOMMEND] Full gRPC response keys: ${JSON.stringify(Object.keys(response))}`);
      this.logger.log(`[RECOMMEND] Full gRPC response: ${JSON.stringify(response, null, 2)}`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[RECOMMEND-ERROR] Service unavailable: ${error.message}`, error.stack);
      throw new HttpException('LLM Orchestrator service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Switch business model và trigger Helm deployment
   */
  async switchBusinessModel(
    to_model: string,
    tenant_id: string = 'default',
    dry_run: boolean = false,
  ): Promise<SwitchModelResponse> {
    const validModels = ['retail', 'subscription', 'freemium', 'multi'];
    if (!validModels.includes(to_model)) {
      throw new BadRequestException(`Invalid model. Must be one of: ${validModels.join(', ')}`);
    }

    const start = Date.now();
    this.logger.log(`[SWITCH] to_model=${to_model} | tenant=${tenant_id} | dry_run=${dry_run}`);

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.switchBusinessModel({
          to_model,
          tenant_id,
          dry_run,
        }).pipe(
          catchError(error => {
            this.logger.error(`[SWITCH-ERROR] gRPC error: ${error.details || error.message}`);
            throw new HttpException(error.details || 'Switch model failed', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      ) as SwitchModelResponse;

      const elapsed = Date.now() - start;
      this.logger.log(`[SWITCH-DONE] took ${elapsed}ms | success=${response.success}`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[SWITCH-ERROR] Service unavailable: ${error.message}`, error.stack);
      throw new HttpException('LLM Orchestrator service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Text-to-SQL: Natural language to SQL query
   */
  async textToSql(question: string, lang: string = 'vi') {
    if (!question || typeof question !== 'string') {
      throw new BadRequestException('question is required');
    }

    const start = Date.now();
    this.logger.log(`[TEXT-TO-SQL] question="${question.substring(0, 50)}..." | lang=${lang}`);

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.textToSql({
          question,
          lang,
        }).pipe(
          catchError(error => {
            this.logger.error(`[TEXT-TO-SQL-ERROR] gRPC error: ${error.details || error.message}`);
            throw new HttpException(error.details || 'Text-to-SQL failed', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );

      const elapsed = Date.now() - start;
      this.logger.log(`[TEXT-TO-SQL-DONE] took ${elapsed}ms`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[TEXT-TO-SQL-ERROR] Service unavailable: ${error.message}`, error.stack);
      throw new HttpException('LLM Orchestrator service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Analyze system incident
   */
  async analyzeIncident(incident_description: string, logs?: string, lang: string = 'vi') {
    if (!incident_description || typeof incident_description !== 'string') {
      throw new BadRequestException('incident_description is required');
    }

    const start = Date.now();
    this.logger.log(`[ANALYZE-INCIDENT] incident="${incident_description.substring(0, 50)}..." | lang=${lang}`);

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.analyzeIncident({
          incident_description,
          logs,
          lang,
        }).pipe(
          catchError(error => {
            this.logger.error(`[ANALYZE-INCIDENT-ERROR] gRPC error: ${error.details || error.message}`);
            throw new HttpException(error.details || 'Incident analysis failed', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );

      const elapsed = Date.now() - start;
      this.logger.log(`[ANALYZE-INCIDENT-DONE] took ${elapsed}ms`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[ANALYZE-INCIDENT-ERROR] Service unavailable: ${error.message}`, error.stack);
      throw new HttpException('LLM Orchestrator service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Generate Dynamic Changeset using AI/RAG (API 2)
   * With optional Helm validation and automatic deployment
   */
  async generateDynamicChangeset(
    user_intent: string,
    current_model?: string,
    target_model?: string,
    force_services?: string[],
    exclude_services?: string[],
    dry_run: boolean = true,
    deploy_after_validation: boolean = false,
    tenant_id: string = 'default',
  ): Promise<DynamicChangesetResponse> {
    if (!user_intent || typeof user_intent !== 'string') {
      throw new BadRequestException('user_intent is required');
    }

    const start = Date.now();
    this.logger.log(`[DYNAMIC-CHANGESET] intent="${user_intent.substring(0, 50)}..." | dry_run=${dry_run} | deploy=${deploy_after_validation}`);

    try {
      const response = await firstValueFrom(
        this.llmGrpcService.generateDynamicChangeset({
          user_intent,
          current_model,
          target_model,
          force_services: force_services || [],
          exclude_services: exclude_services || [],
          dry_run,
          deploy_after_validation,
          tenant_id,
        }).pipe(
          catchError(error => {
            this.logger.error(`[DYNAMIC-CHANGESET-ERROR] gRPC error: ${error.details || error.message}`);
            throw new HttpException(
              {
                success: false,
                message: 'Dynamic changeset generation failed',
                error: error.details || error.message,
                fallback_available: true,
                fallback_models: ['retail', 'subscription', 'freemium', 'multi'],
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }),
        ),
      ) as DynamicChangesetResponse;

      const elapsed = Date.now() - start;
      this.logger.log(`[DYNAMIC-CHANGESET-DONE] took ${elapsed}ms | success=${response.success} | deployed=${response.deployed}`);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[DYNAMIC-CHANGESET-ERROR] Service unavailable: ${error.message}`, error.stack);
      
      // Return structured error with fallback options
      return {
        success: false,
        message: 'LLM Orchestrator service unavailable',
        error: error.message,
        fallback_available: true,
        fallback_models: ['retail', 'subscription', 'freemium', 'multi'],
      };
    }
  }
}