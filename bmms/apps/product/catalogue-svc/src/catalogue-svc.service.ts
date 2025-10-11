import { Injectable } from '@nestjs/common';

@Injectable()
export class catalogueSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
