import { Injectable } from '@nestjs/common';

@Injectable()
export class customerSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
