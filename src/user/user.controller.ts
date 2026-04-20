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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('getUser')
  getUser(): string {
    return this.userService.getUser();
  }

  @Post('add')
  createUser(@Body() user: CreateUserDto) {
    // 业务中 要保持controller简洁 逻辑业务放入service
    return this.userService.addUser(user);
  }

  @Get('list')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }

  @Put(':id')
  updateUser(@Param('id') id: string, @Body() user: UpdateUserDto) {
    return this.userService.updateUser(id, user);
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
  updateUser1(@Param('id') id: string, @Body() user: User) {
    return this.userService.updateUser(id, user);
  }
}
