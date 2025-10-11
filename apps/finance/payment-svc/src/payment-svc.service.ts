import { Injectable } from '@nestjs/common';

@Injectable()
export class paymentSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
