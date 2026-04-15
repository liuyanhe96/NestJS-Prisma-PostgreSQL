import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
  getOrder(): string {
    return 'This is the Order';
  }
}
