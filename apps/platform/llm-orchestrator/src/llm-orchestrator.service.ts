import { Injectable } from '@nestjs/common';

@Injectable()
export class llmOrchestratorService {
  getHello(): string {
    return 'Hello World!';
  }
}
