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
  switchBusinessModel(data: {
    to_model: string;
    tenant_id: string;
    dry_run: boolean;
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
}