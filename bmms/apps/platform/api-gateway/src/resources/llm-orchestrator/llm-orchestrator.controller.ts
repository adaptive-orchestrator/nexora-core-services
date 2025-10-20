import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBody,
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
}
