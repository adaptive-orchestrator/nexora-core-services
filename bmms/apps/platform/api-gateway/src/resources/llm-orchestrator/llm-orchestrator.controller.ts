import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Query,
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
}
