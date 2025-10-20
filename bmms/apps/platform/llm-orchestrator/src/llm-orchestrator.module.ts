import { Module } from '@nestjs/common';
import { LlmOrchestratorController } from './llm-orchestrator.controller';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<number>('TOKEN_EXPIRE_TIME')
        },
      }),
    }),



  ],
  controllers: [LlmOrchestratorController],
  providers: [LlmOrchestratorService],
})
export class LlmOrchestratorModule { }
