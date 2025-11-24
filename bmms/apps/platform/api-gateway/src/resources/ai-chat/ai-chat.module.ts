import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'LLM_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'llm',
          protoPath: join(__dirname, '../../proto/llm-orchestrator.proto'),
          url: process.env.LLM_SERVICE_URL || 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
