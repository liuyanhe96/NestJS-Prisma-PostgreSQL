import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  // 具体业务逻辑 调用第三方API 访问数据库 数据转换
  getUser(): string {
    return 'This is User Module';
  }
}
