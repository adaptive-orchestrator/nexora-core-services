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
}

@Injectable()
export class LlmOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(LlmOrchestratorService.name);
  private llmGrpcService: LlmOrchestratorGrpcService;

  constructor(@Inject('LLM_PACKAGE') private readonly client: ClientGrpc) {}

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
}