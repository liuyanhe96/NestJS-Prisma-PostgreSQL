import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module'; // 直接引入子模块的Module 不再单独引入controller和service
// import { UserController } from './user/user.controller';
// import { UserService } from './user/user.service';
import { OrderModule } from './order/order.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostModule } from './post/post.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    UserModule,
    OrderModule,
    PrismaModule, // 全局 Prisma（只注册一次）
    PostModule,
    ConfigModule.forRoot({
      isGlobal: true, // 配置完后 process.env.DATABASE_URL就会有值了
    }),
  ], // 注册子模块
  controllers: [AppController], // 注册控制器
  providers: [AppService], // 注册服务
})
export class AppModule {}
