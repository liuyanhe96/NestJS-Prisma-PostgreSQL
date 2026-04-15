import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module'; // 直接引入子模块的Module 不再单独引入controller和service
// import { UserController } from './user/user.controller';
// import { UserService } from './user/user.service';
import { OrderModule } from './order/order.module';

@Module({
  imports: [UserModule, OrderModule], // 注册子模块
  controllers: [AppController], // 注册控制器
  providers: [AppService], // 注册服务
})
export class AppModule {}
