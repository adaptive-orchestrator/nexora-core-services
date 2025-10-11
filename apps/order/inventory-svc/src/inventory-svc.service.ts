import { Injectable } from '@nestjs/common';

@Injectable()
export class inventorySvcService {
  getHello(): string {
    return 'Hello World!';
  }
}
