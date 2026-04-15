import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [], // 注册子模块
  controllers: [AppController], // 注册控制器
  providers: [AppService], // 注册服务
})
export class AppModule {}
