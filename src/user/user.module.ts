import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MailService } from './mail.service';

@Module({
  imports: [], // 注册子模块
  controllers: [UserController], // 注册控制器
  providers: [UserService, MailService], // 注册服务
})
export class UserModule {}
