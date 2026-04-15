import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [], // 注册子模块
  controllers: [UserController], // 注册控制器
  providers: [UserService], // 注册服务
})
export class UserModule {}
