import { Injectable } from '@nestjs/common';

@Injectable()
export class subscriptionSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
