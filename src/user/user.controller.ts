import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('getUser')
  getUser(): string {
    return this.userService.getUser();
  }

  @Post('add')
  createUser(@Body() user: User) {
    // 业务中 要保持controller简洁 逻辑业务放入service
    return this.userService.createUser(user);
  }
}
