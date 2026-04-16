import { Injectable } from '@nestjs/common';
import { User } from './user';
import { MailService } from './mail.service';

@Injectable()
export class UserService {
  constructor(private readonly mailService: MailService) {}
  // 具体业务逻辑 调用第三方API 访问数据库 数据转换
  getUser(): string {
    return 'This is User Module';
  }

  createUser(user: User) {
    // 模拟创建
    // service 也可以引入其他service功能
    this.mailService.sendMail('xxxx@gmail.com', 'nihao', 'Have good day');
    return {
      success: true,
      msg: `用户 ${user.name} 创建成功`,
      id: Date.now(),
      name: user.name,
      age: user.age,
    };
  }
}
