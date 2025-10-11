import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomerSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
