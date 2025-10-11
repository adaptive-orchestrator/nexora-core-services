import { Injectable } from '@nestjs/common';

@Injectable()
export class promotionSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
