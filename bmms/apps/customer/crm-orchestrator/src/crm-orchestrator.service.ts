import { Injectable } from '@nestjs/common';

@Injectable()
export class crmOrchestratorService {
  getHello(): string {
    return 'Hello World!';
  }
}
