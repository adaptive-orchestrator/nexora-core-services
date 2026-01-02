import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Query,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtGuard } from '../../guards/jwt.guard';

import { LlmChatRequestDto } from './dto/llm-chat-request.dto';
import {
  LlmChatResponseDto,
  LlmErrorResponseDto,
} from './dto/response.dto';
import { 
  DynamicChangesetRequestDto, 
  DynamicChangesetResponseDto,
  validateDynamicChangesetRequest,
  VALID_BUSINESS_MODELS,
} from './dto/dynamic-changeset.dto';
import { LlmOrchestratorService } from './llm-orchestrator.service';

@ApiTags('LLM Orchestrator')
@ApiBearerAuth('accessToken')
@Controller('llm-orchestrator')
export class LlmOrchestratorController {
  constructor(
    private readonly llmOrchestratorService: LlmOrchestratorService,
  ) {}

  @Post('chat')
  // Có thể bật/tắt guard JWT tùy môi trường
  // @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a single business request to LLM orchestrator',
    description:
      'Phân tích câu lệnh nghiệp vụ tự nhiên và sinh ra bản proposal kèm changeset có cấu trúc.',
  })
  @ApiBody({ type: LlmChatRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Response chứa đề xuất và changeset',
    type: LlmChatResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Thiếu hoặc sai định dạng dữ liệu đầu vào',
    type: LlmErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized',
    type: LlmErrorResponseDto,
  })
  async chatOnce(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    body: LlmChatRequestDto,
  ) {
    const { message, tenant_id, role, lang } = body;
    return this.llmOrchestratorService.ask(
      message,
      tenant_id,
      role,
      lang ?? 'vi',
    );
  }

  @Post('chat-and-deploy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat with LLM and trigger K8s deployment (via gRPC + Kafka)',
    description: 'Phân tích nghiệp vụ qua gRPC. LLM tự động publish Kafka event. Dùng ?dryRun=true để chỉ sinh YAML.',
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tôi muốn 2 sản phẩm retail và 1 gói subscription' },
        tenant_id: { type: 'string', example: 't-customer-123' },
        role: { type: 'string', example: 'admin' },
        lang: { type: 'string', enum: ['vi', 'en'], example: 'vi' },
      },
      required: ['message'],
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Response chứa LLM output. Kafka event được publish tự động.',
  })
  async chatAndDeploy(
    @Body(new ValidationPipe({ whitelist: true }))
    body: LlmChatRequestDto,
    @Query('dryRun') dryRun?: string,
  ) {
    const { message, tenant_id, role, lang } = body;
    
    // Call LLM via gRPC
    // LLM will automatically trigger Kafka deployment after processing
    const llmResponse = await this.llmOrchestratorService.ask(
      message,
      tenant_id,
      role,
      lang ?? 'vi',
    );

    return {
      llm: llmResponse,
      deployment: {
        message: 'Deployment event will be published automatically by LLM service',
        mode: dryRun === 'true' ? 'DRY-RUN (YAML only)' : 'FULL (Apply to K8s)',
        note: 'Check LLM Orchestrator and K8s Generator logs for deployment status',
      },
    };
  }

  @Post('recommend-model')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI tư vấn mô hình kinh doanh phù hợp',
    description: 'Dựa trên mô tả kinh doanh, AI sẽ đề xuất mô hình phù hợp nhất (retail, subscription, freemium, multi)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        business_description: { 
          type: 'string', 
          example: 'Tôi muốn bán khóa học online về lập trình, học viên có thể mua lẻ từng khóa hoặc đăng ký gói membership',
          description: 'Mô tả về sản phẩm/dịch vụ bạn muốn kinh doanh'
        },
        target_audience: { 
          type: 'string', 
          example: 'Sinh viên, người đi làm muốn học thêm kỹ năng',
          description: 'Đối tượng khách hàng mục tiêu (tùy chọn)'
        },
        revenue_preference: { 
          type: 'string', 
          example: 'Tôi muốn có doanh thu ổn định hàng tháng',
          description: 'Mong muốn về doanh thu (tùy chọn)'
        },
        lang: { 
          type: 'string', 
          enum: ['vi', 'en'], 
          example: 'vi',
          description: 'Ngôn ngữ trả lời'
        },
      },
      required: ['business_description'],
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả tư vấn mô hình kinh doanh',
    schema: {
      type: 'object',
      properties: {
        recommended_model: { type: 'string', example: 'subscription' },
        explanation: { type: 'string', example: 'Với mô hình bán khóa học online...' },
        confidence: { type: 'number', example: 0.85 },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              reason: { type: 'string' },
              score: { type: 'number' },
            }
          }
        }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'business_description is required',
  })
  async recommendBusinessModel(
    @Body() body: {
      business_description: string;
      target_audience?: string;
      revenue_preference?: string;
      lang?: string;
    },
  ) {
    return this.llmOrchestratorService.recommendBusinessModel(
      body.business_description,
      body.target_audience,
      body.revenue_preference,
      body.lang ?? 'vi',
    );
  }

  @Post('recommend-model-detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI tư vấn mô hình với detailed changeset cho Human-in-the-loop workflow',
    description: 'Trả về đề xuất kèm changeset chi tiết bao gồm impacted services, features, risk assessment',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        business_description: { 
          type: 'string', 
          example: 'Chuyển đổi nhóm sản phẩm A sang mô hình đăng ký theo tháng',
        },
        current_model: {
          type: 'string',
          enum: ['retail', 'subscription', 'freemium', 'multi'],
          example: 'retail',
          description: 'Mô hình hiện tại',
        },
        target_audience: { type: 'string', example: 'Sinh viên' },
        revenue_preference: { type: 'string', example: 'Thu nhập ổn định hàng tháng' },
        lang: { type: 'string', enum: ['vi', 'en'], example: 'vi' },
      },
      required: ['business_description', 'current_model'],
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả tư vấn với detailed changeset',
    schema: {
      type: 'object',
      properties: {
        proposal_text: { type: 'string' },
        changeset: {
          type: 'object',
          properties: {
            model: { type: 'string', example: 'BusinessModel' },
            features: { type: 'array', items: { type: 'object' } },
            impacted_services: { type: 'array', items: { type: 'string' } },
          }
        },
        metadata: {
          type: 'object',
          properties: {
            intent: { type: 'string', example: 'business_model_change' },
            confidence: { type: 'number', example: 0.95 },
            risk: { type: 'string', enum: ['low', 'medium', 'high'] },
            from_model: { type: 'string' },
            to_model: { type: 'string' },
          }
        }
      }
    }
  })
  async recommendBusinessModelDetailed(
    @Body() body: {
      business_description: string;
      current_model: string;
      target_audience?: string;
      revenue_preference?: string;
      lang?: string;
    },
  ) {
    return this.llmOrchestratorService.recommendBusinessModelDetailed(
      body.business_description,
      body.current_model,
      body.target_audience,
      body.revenue_preference,
      body.lang ?? 'vi',
    );
  }

  @Post('switch-model')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chuyển đổi mô hình kinh doanh và cấu hình Helm deployment',
    description: 'Chuyển từ model hiện tại sang model mới. Hệ thống sẽ tự động generate Helm changeset và (nếu auto-deploy enabled) apply vào K8s cluster.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to_model: {
          type: 'string',
          enum: ['retail', 'subscription', 'freemium', 'multi'],
          example: 'subscription',
          description: 'Model muốn chuyển sang',
        },
        tenant_id: {
          type: 'string',
          example: 'tenant-123',
          description: 'ID của tenant (tùy chọn)',
        },
        dry_run: {
          type: 'boolean',
          example: false,
          description: 'Nếu true, chỉ generate YAML mà không deploy',
        },
      },
      required: ['to_model'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả chuyển đổi model',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Model switched successfully' },
        changeset_path: { type: 'string', example: '/app/changesets/changeset-subscription-2025-01-01.yaml' },
        deployed: { type: 'boolean', example: true },
        dry_run: { type: 'boolean', example: false },
        helm_dry_run_results: {
          type: 'object',
          description: 'Kết quả Helm dry-run (chỉ có khi dry_run=true)',
          properties: {
            validation_passed: { type: 'boolean', example: true },
            databases_output: { type: 'string', description: 'Rendered database manifests YAML' },
            services_output: { type: 'string', description: 'Rendered services manifests YAML' },
            validation_errors: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid model. Must be one of: retail, subscription, freemium, multi',
  })
  async switchBusinessModel(
    @Body() body: {
      to_model: string;
      tenant_id?: string;
      dry_run?: boolean;
    },
  ) {
    return this.llmOrchestratorService.switchBusinessModel(
      body.to_model,
      body.tenant_id ?? 'default',
      body.dry_run ?? false,
    );
  }

  @Post('text-to-sql')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Natural language to SQL query',
    description: 'Chuyển đổi câu hỏi tự nhiên thành SQL query và thực thi (nếu TEXT_TO_SQL_ENABLED=true)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          example: 'Cho tôi biết tổng doanh thu tháng này',
          description: 'Câu hỏi bằng ngôn ngữ tự nhiên'
        },
        lang: {
          type: 'string',
          enum: ['vi', 'en'],
          example: 'vi',
          description: 'Ngôn ngữ trả lời'
        },
      },
      required: ['question'],
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả query',
    schema: {
      type: 'object',
      properties: {
        answer: { type: 'string', example: 'Tổng doanh thu tháng này là 150.000.000 đ' },
        sql: { type: 'string', example: 'SELECT SUM(amount) FROM orders WHERE ...' },
        data: { type: 'array', items: { type: 'object' } },
      }
    }
  })
  async textToSql(
    @Body() body: { question: string; lang?: string },
  ) {
    return this.llmOrchestratorService.textToSql(body.question, body.lang ?? 'vi');
  }

  @Post('analyze-incident')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze system incident / Root Cause Analysis',
    description: 'Phân tích sự cố hệ thống và đưa ra khuyến nghị (RCA)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        incident_description: {
          type: 'string',
          example: 'Service payment-svc không phản hồi, timeout sau 30s',
          description: 'Mô tả sự cố (tùy chọn nếu có errorLog)'
        },
        errorLog: {
          type: 'string',
          example: '[PaymentService] Error: Connection timeout',
          description: 'Log lỗi hệ thống'
        },
        question: {
          type: 'string',
          example: 'Tại sao thanh toán bị lỗi?',
          description: 'Câu hỏi về sự cố (tùy chọn)'
        },
        logs: {
          type: 'string',
          example: 'Error: Connection refused...',
          description: 'Log hệ thống bổ sung (tùy chọn)'
        },
        lang: {
          type: 'string',
          enum: ['vi', 'en'],
          example: 'vi',
        },
      },
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phân tích sự cố',
    schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', example: 'critical' },
        analysis: { type: 'string', example: 'Root cause: Database connection pool exhausted...' },
        recommendations: { type: 'array', items: { type: 'string' } },
        raw_response: { type: 'string' },
      }
    }
  })
  async analyzeIncident(
    @Body() body: { 
      incident_description?: string; 
      errorLog?: string;
      question?: string;
      logs?: string; 
      lang?: string 
    },
  ) {
    // Support both formats: errorLog (from test) and incident_description (from gRPC)
    const incidentDesc = body.errorLog || body.incident_description;
    
    if (!incidentDesc) {
      throw new HttpException(
        'Either errorLog or incident_description is required', 
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.llmOrchestratorService.analyzeIncident(
      incidentDesc,
      body.logs,
      body.lang ?? 'vi',
    ) as any;

    // Transform gRPC response to frontend format
    // gRPC returns: { severity, analysis: string, recommendations, raw_response }
    // Frontend expects: { success, analysis: object, codeContext, error }
    
    if (result.raw_response) {
      try {
        // Parse the raw_response which contains the structured RCA analysis
        const parsedAnalysis = JSON.parse(result.raw_response);
        
        return {
          success: true,
          analysis: parsedAnalysis,
          codeContext: result.recommendations || [],
          error: undefined,
        };
      } catch (parseError) {
        // If parsing fails, fall back to legacy format
        return result;
      }
    }
    
    // If no raw_response, return as-is (shouldn't happen)
    return result;
  }

  @Post('generate-dynamic-changeset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Dynamic Changeset using AI/RAG',
    description: `
API 2: AI-powered service discovery and changeset generation.
- Uses RAG to discover services from codebase
- Generates custom changeset based on user intent
- Supports Helm dry-run validation
- Can auto-deploy if validation passes
- Falls back to switch-model API (4 fixed profiles) if AI fails

Workflow:
1. AI generates changeset → 2. Helm dry-run validates → 3. Auto-deploy OR user chooses fallback
    `,
  })
  @ApiBody({ type: DynamicChangesetRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dynamic changeset generation result',
    type: DynamicChangesetResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - user_intent is required',
  })
  async generateDynamicChangeset(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    body: DynamicChangesetRequestDto,
  ) {
    // Validate with Zod for extra safety
    const validation = validateDynamicChangesetRequest(body);
    if (!validation.success) {
      throw new HttpException(
        {
          success: false,
          message: 'Validation failed',
          errors: validation.errors?.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
          fallback_available: true,
          fallback_models: VALID_BUSINESS_MODELS,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.llmOrchestratorService.generateDynamicChangeset(
      body.user_intent,
      body.current_model,
      body.target_model,
      body.force_services,
      body.exclude_services,
      body.dry_run ?? true,
      body.deploy_after_validation ?? false,
      body.tenant_id ?? 'default',
    );
  }

  @Post('smart-switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Smart Model Switch - Try API 2 first, fallback to API 1',
    description: `
Intelligent business model switching workflow:
1. Try AI-powered dynamic changeset (API 2) with Helm dry-run
2. If validation passes AND deploy_after_validation=true → Auto-deploy
3. If validation fails → Return options to use API 1 (switch-model with 4 fixed profiles)

This is the recommended endpoint for production use.
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_intent: {
          type: 'string',
          example: 'Chuyển sang mô hình subscription với thanh toán định kỳ hàng tháng',
          description: 'User intent for AI analysis',
        },
        current_model: {
          type: 'string',
          enum: ['retail', 'subscription', 'freemium', 'multi'],
          example: 'retail',
        },
        target_model: {
          type: 'string',
          enum: ['retail', 'subscription', 'freemium', 'multi'],
          example: 'subscription',
        },
        auto_deploy: {
          type: 'boolean',
          example: false,
          description: 'If true, deploy automatically when validation passes',
        },
        use_fallback_on_failure: {
          type: 'boolean',
          example: true,
          description: 'If true, automatically use API 1 when API 2 fails',
        },
        tenant_id: {
          type: 'string',
          example: 'tenant-123',
        },
      },
      required: ['user_intent'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Smart switch result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        api_used: { type: 'string', enum: ['dynamic-changeset', 'switch-model'] },
        message: { type: 'string' },
        changeset: { type: 'object' },
        helm_validation: { type: 'object' },
        deployed: { type: 'boolean' },
        fallback_options: {
          type: 'object',
          properties: {
            available: { type: 'boolean' },
            models: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
          },
        },
      },
    },
  })
  async smartSwitch(
    @Body() body: {
      user_intent: string;
      current_model?: string;
      target_model?: string;
      auto_deploy?: boolean;
      use_fallback_on_failure?: boolean;
      tenant_id?: string;
    },
  ) {
    const { 
      user_intent, 
      current_model, 
      target_model, 
      auto_deploy = false, 
      use_fallback_on_failure = true,
      tenant_id = 'default',
    } = body;

    if (!user_intent || user_intent.trim() === '') {
      throw new HttpException('user_intent is required', HttpStatus.BAD_REQUEST);
    }

    // Step 1: Try API 2 (Dynamic Changeset with AI)
    this.llmOrchestratorService['logger'].log(
      `[SMART-SWITCH] Trying API 2 (dynamic-changeset) first...`
    );

    const api2Result = await this.llmOrchestratorService.generateDynamicChangeset(
      user_intent,
      current_model,
      target_model,
      undefined, // force_services
      undefined, // exclude_services
      true, // dry_run = true for validation
      auto_deploy, // deploy_after_validation
      tenant_id,
    );

    // If API 2 succeeds with validation passed
    if (api2Result.success && api2Result.helm_validation?.validation_passed) {
      return {
        success: true,
        api_used: 'dynamic-changeset',
        message: api2Result.deployed 
          ? 'AI-generated changeset deployed successfully'
          : 'AI-generated changeset validated successfully (ready to deploy)',
        changeset: api2Result.changeset,
        helm_validation: api2Result.helm_validation,
        deployed: api2Result.deployed,
        files: {
          json: api2Result.json_path,
          yaml: api2Result.yaml_path,
        },
        fallback_options: {
          available: !api2Result.deployed,
          models: VALID_BUSINESS_MODELS,
          recommendation: api2Result.deployed 
            ? null 
            : `Changeset validated. Call switch-model with to_model="${target_model || api2Result.changeset?.to_model}" to deploy.`,
        },
      };
    }

    // Step 2: API 2 failed - check if should use fallback
    this.llmOrchestratorService['logger'].warn(
      `[SMART-SWITCH] API 2 failed: ${api2Result.error}`
    );

    if (!use_fallback_on_failure) {
      return {
        success: false,
        api_used: 'dynamic-changeset',
        message: 'AI-generated changeset failed validation',
        error: api2Result.error,
        helm_validation: api2Result.helm_validation,
        deployed: false,
        fallback_options: {
          available: true,
          models: VALID_BUSINESS_MODELS,
          recommendation: `Use POST /llm-orchestrator/switch-model with one of: ${VALID_BUSINESS_MODELS.join(', ')}`,
        },
      };
    }

    // Step 3: Use fallback (API 1) if target_model is valid
    if (target_model && VALID_BUSINESS_MODELS.includes(target_model as any)) {
      this.llmOrchestratorService['logger'].log(
        `[SMART-SWITCH] Falling back to API 1 (switch-model) with target_model="${target_model}"`
      );

      const api1Result = await this.llmOrchestratorService.switchBusinessModel(
        target_model,
        tenant_id,
        true, // dry_run first
      );

      if (api1Result.success && api1Result.helm_dry_run_results?.validation_passed) {
        // If auto_deploy is true, do actual deployment
        if (auto_deploy) {
          const deployResult = await this.llmOrchestratorService.switchBusinessModel(
            target_model,
            tenant_id,
            false, // actual deploy
          );

          return {
            success: deployResult.success,
            api_used: 'switch-model',
            message: `Fallback to fixed profile "${target_model}" - deployed successfully`,
            changeset_path: deployResult.changeset_path,
            helm_validation: api1Result.helm_dry_run_results,
            deployed: deployResult.deployed,
            fallback_options: {
              available: false,
              models: [],
              recommendation: null,
            },
            note: 'Used API 1 (switch-model) after API 2 (dynamic-changeset) failed',
          };
        }

        return {
          success: true,
          api_used: 'switch-model',
          message: `Fallback to fixed profile "${target_model}" validated successfully`,
          changeset_path: api1Result.changeset_path,
          helm_validation: api1Result.helm_dry_run_results,
          deployed: false,
          fallback_options: {
            available: true,
            models: VALID_BUSINESS_MODELS,
            recommendation: `Call switch-model with dry_run=false to deploy "${target_model}"`,
          },
          note: 'Used API 1 (switch-model) after API 2 (dynamic-changeset) failed',
        };
      }

      // API 1 also failed
      return {
        success: false,
        api_used: 'switch-model',
        message: 'Both API 2 and API 1 failed validation',
        errors: {
          api2_error: api2Result.error,
          api1_error: api1Result.error,
          api1_validation_errors: api1Result.helm_dry_run_results?.validation_errors,
        },
        deployed: false,
        fallback_options: {
          available: true,
          models: VALID_BUSINESS_MODELS,
          recommendation: 'Check Helm charts configuration and K8s cluster status',
        },
      };
    }

    // No valid target_model for fallback
    return {
      success: false,
      api_used: 'dynamic-changeset',
      message: 'AI-generated changeset failed, no valid target_model for fallback',
      error: api2Result.error,
      helm_validation: api2Result.helm_validation,
      deployed: false,
      fallback_options: {
        available: true,
        models: VALID_BUSINESS_MODELS,
        recommendation: `Specify target_model as one of: ${VALID_BUSINESS_MODELS.join(', ')} to enable fallback`,
      },
    };
  }
}
