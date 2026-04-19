import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  providers: [PostService],
  imports: [PrismaModule],
  controllers: [PostController],
})
export class PostModule {}
