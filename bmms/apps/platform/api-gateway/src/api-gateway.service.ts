import { Injectable } from '@nestjs/common';

@Injectable()
export class apiGatewayService {
  getHello(): string {
    return 'Hello World!';
  }
}
