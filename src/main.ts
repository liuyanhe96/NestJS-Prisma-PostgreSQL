import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // 创建 NestJS 应用，传入根模块
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3007);
}
bootstrap();
