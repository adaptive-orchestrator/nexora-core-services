import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ description: 'Chat message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Conversation context', type: [Object] })
  @IsArray()
  @IsOptional()
  context?: any[];

  @ApiPropertyOptional({ description: 'Request code generation' })
  @IsOptional()
  generateCode?: boolean;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'AI response message' })
  message: string;

  @ApiProperty({ description: 'Generated code if requested' })
  code?: string;

  @ApiProperty({ description: 'Code language' })
  language?: string;

  @ApiProperty({ description: 'Timestamp' })
  timestamp: string;
}

export class ConversationHistoryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty({ type: [Object] })
  messages: any[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
