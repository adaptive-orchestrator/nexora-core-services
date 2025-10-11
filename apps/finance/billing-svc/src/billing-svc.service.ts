import { Injectable } from '@nestjs/common';

@Injectable()
export class billingSvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
