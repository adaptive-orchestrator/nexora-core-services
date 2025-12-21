import { Injectable } from '@nestjs/common';

@Injectable()
export class JobSchedulerService {
  getHello(): string {
    return 'Hello World!';
  }
}
