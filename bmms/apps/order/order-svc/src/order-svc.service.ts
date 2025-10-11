import { Injectable } from '@nestjs/common';

@Injectable()
export class orderSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
