import { Injectable } from '@nestjs/common';

@Injectable()
export class rlSchedulerService {
  getHello(): string {
    return 'Hello World!';
  }
}
