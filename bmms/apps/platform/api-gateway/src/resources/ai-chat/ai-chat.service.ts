import { Injectable, NotFoundException, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ChatMessageDto } from './dto/chat.dto';

interface ILlmGrpcService {
  generateText(data: any): any;
  generateCode(data: any): any;
}

// Temporary in-memory storage
const conversations: any[] = [];
let conversationIdCounter = 1;

@Injectable()
export class AiChatService implements OnModuleInit {
  private llmService: ILlmGrpcService;

  constructor(
    @Inject('LLM_PACKAGE') private client: ClientGrpc
  ) {}

  onModuleInit() {
    this.llmService = this.client.getService<ILlmGrpcService>('LlmOrchestratorService');
  }

  async sendMessage(userId: number, dto: ChatMessageDto) {
    try {
      let response;
      
      if (dto.generateCode) {
        // Request code generation
        response = await firstValueFrom(
          this.llmService.generateCode({
            prompt: dto.message,
            context: dto.context || [],
          })
        );

        // Save to conversation history
        this.saveToHistory(userId, dto.message, response.code, response.language);

        return {
          message: response.explanation || 'Code generated successfully',
          code: response.code,
          language: response.language || 'python',
          timestamp: new Date().toISOString(),
        };
      } else {
        // Regular text chat
        response = await firstValueFrom(
          this.llmService.generateText({
            prompt: dto.message,
            context: dto.context || [],
          })
        );

        // Save to conversation history
        this.saveToHistory(userId, dto.message, response.text);

        return {
          message: response.text,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      // Fallback response if LLM service unavailable
      return {
        message: 'AI Assistant is currently unavailable. Please try again later.',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private saveToHistory(userId: number, userMessage: string, aiResponse: string, language?: string) {
    let conversation = conversations.find(c => c.userId === userId && c.isActive);
    
    if (!conversation) {
      conversation = {
        id: conversationIdCounter++,
        userId,
        messages: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      conversations.push(conversation);
    }

    conversation.messages.push(
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: aiResponse,
        language,
        timestamp: new Date().toISOString(),
      }
    );

    conversation.updatedAt = new Date().toISOString();
  }

  async getConversationHistory(userId: number) {
    return conversations.filter(c => c.userId === userId);
  }

  async getConversation(id: number, userId: number) {
    const conversation = conversations.find(c => c.id === id && c.userId === userId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }
}
