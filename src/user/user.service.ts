import { Injectable } from '@nestjs/common';
import { User } from './user';
import { MailService } from './mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  // 模拟db中的数据
  private usersDB: User[] = [
    {
      id: 1,
      name: '张三',
      age: 18,
      email: 'zhangsan@example.com',
      password: '123456',
    },
    {
      id: 2,
      name: '李四',
      age: 19,
      email: 'lisi@example.com',
      password: '123456',
    },
    {
      id: 3,
      name: '王五',
      age: 20,
      email: 'wangwu@example.com',
      password: '123456',
    },
  ];

  // 具体业务逻辑 调用第三方API 访问数据库 数据转换
  getUser(): string {
    return 'This is User Module';
  }

  async addUser(user: CreateUserDto) {
    const newUser = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role || 'user',
      },
    });

    return {
      success: true,
      msg: `用户${user.name}-添加成功`,
      data: newUser,
    };
  }

  getUserById(id: string) {
    return {
      id: id,
      success: true,
      name: id + 'Test',
      msg: `This is User ${id}`,
    };
  }

  getList(page: number, limit: number) {
    // 模拟分页数据
    return [
      {
        id: 1,
        name: '张三',
        age: 18,
        page: page,
        limit: limit,
      },
      {
        id: 2,
        name: '李四',
        age: 19,
        page: page,
        limit: limit,
      },
    ];
  }

  updateUser(id: string, user: User) {
    const index = this.usersDB.findIndex((u) => u.id === parseInt(id));
    if (index === -1) {
      return {
        success: false,
        msg: `用户 ${id} 不存在`,
      };
    }
    this.usersDB[index] = {
      age: user.age || this.usersDB[index].age,
      email: user.email || this.usersDB[index].email,
      name: user.name || this.usersDB[index].name,
      password: user.password || this.usersDB[index].password,
      id: parseInt(id),
    };
    return {
      success: true,
      msg: `用户 ${user.name} 更新成功`,
      id: user.id,
      name: user.name,
      age: user.age,
    };
  }

  deleteUser(id: string) {
    const index = this.usersDB.findIndex((u) => u.id === parseInt(id));
    if (index === -1) {
      return {
        success: false,
        msg: `用户 ${id} 不存在`,
      };
    }
    this.usersDB.splice(index, 1);
    return {
      success: true,
      msg: `用户 ${id} 删除成功`,
    };
  }
}
