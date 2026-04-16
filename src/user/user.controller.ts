import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
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

  @Get('get/:id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Get('list')
  getList(@Query('page') page: number, @Query('limit') limit: number) {
    // 模拟分页查询 调用db
    return this.userService.getList(page, limit);
  }

  @Put('update/:id')
  updateUser(@Param('id') id: string, @Body() user: User) {
    return this.userService.updateUser(id, user);
  }

  @Delete('delete/:id')
  deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}
