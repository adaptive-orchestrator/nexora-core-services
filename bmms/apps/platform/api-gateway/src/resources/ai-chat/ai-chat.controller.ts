import { 
  Controller, 
  Post, 
  Get,
  Body, 
  UseGuards, 
  Request,
  HttpStatus,
  Param,
  ParseIntPipe
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth 
} from '@nestjs/swagger';
import { JwtGuard } from '../../guards/jwt.guard';
import { AiChatService } from './ai-chat.service';
import { ChatMessageDto, ChatResponseDto, ConversationHistoryDto } from './dto/chat.dto';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('ai/chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Send message to AI assistant',
    description: 'Send a message to the AI assistant and get a response. Can request code generation.'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'AI response generated successfully', 
    type: ChatResponseDto 
  })
  async sendMessage(
    @Body() chatMessageDto: ChatMessageDto,
    @Request() req: any
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.aiChatService.sendMessage(userId, chatMessageDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get conversation history' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Conversation history retrieved', 
    type: [ConversationHistoryDto] 
  })
  async getHistory(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.aiChatService.getConversationHistory(userId);
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get specific conversation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Conversation retrieved', 
    type: ConversationHistoryDto 
  })
  async getConversation(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.aiChatService.getConversation(id, userId);
  }
}
