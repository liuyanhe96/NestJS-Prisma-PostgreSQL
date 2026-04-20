/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { User } from './user';
import { MailService } from './mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

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
      message: `用户${user.name}-添加成功`,
      data: newUser,
    };
  }

  async findAll() {
    const allUsers = await this.prisma.user.findMany({
      select: {
        // 指定查询的数据
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        //  排序
        id: 'asc',
      },
    });
    return {
      success: true,
      total: allUsers.length,
      message: '查询所有用户成功',
      data: allUsers,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        // 指定查询的数据
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        posts: {
          // 关联查询
          select: {
            id: true,
            title: true,
            content: true,
            published: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user)
      return {
        success: false,
        message: `用户 ${id} 不存在`,
      };

    return {
      success: true,
      data: user,
    };
  }

  async deleteUser(id: string) {
    try {
      await this.prisma.user.delete({
        where: { id: parseInt(id) },
      });
      return {
        success: true,
        message: `删除 用户${id}  成功`,
      };
    } catch {
      return {
        success: false,
        message: `用户${id} 不存在`,
      };
    }
  }

  async updateUser(id: string, user: UpdateUserDto) {
    try {
      const newUser = await this.prisma.user.update({
        where: { id: parseInt(id) },
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
        },
      });
      return {
        success: true,
        message: `更新 用户-${user.name}  成功`,
        data: newUser,
      };
    } catch {
      return {
        success: false,
        message: `用户${id} 不存在`,
      };
    }
  }

  searchUser(query: QueryUserDto) {
    const { page = '1', pageSize = '10', name, role } = query;
    // 计算分页参数
    // skip 跳过前 n 条记录 (分页偏移量)
    // 例如 第一页 page = 1 从第一条开始取
    // 第二页 page = 2 从第 11 条开始取
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    // take 取 n 条记录
    // 例如 take=10 表示取第 10 条记录
    const take = parseInt(pageSize);
    const where: any = {};
    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive', // 不区分大小写
        // mode: 'strict', // 区分大小写
      };
    }
    if (role) {
      where.role = role;
    }

    /**
     * 保证一组数据库操作「要么全部成功，要么全部回滚」，避免部分执行、数据不一致。
     * 一次性传入多个 Prisma 操作，顺序执行，任意报错整体回滚。
     * 原子性：全部成功才提交，任意异常自动回滚
     * 隔离性：事务内操作对外部不可见，提交后才生效
     * 支持锁：可配合 tx.$queryRaw 写锁语句实现悲观锁
     * 限制
     *  数组模式不能包含异步逻辑，只能纯 Prisma 动作
     *  长事务会影响数据库性能、锁等待
     * 
     * 对比：不用事务的问题
        ts
        无事务：第一步成功、第二步报错 → 数据脏了
          await prisma.user.create(...)
          await prisma.profile.create(...) // 报错
        用 $transaction 后：用户创建也会被撤销，数据一致。
     *
        $transaction = Prisma 数据库事务容器，保证多步数据库操作原子执行，是业务数据一致性的核心方案。
     * **/
    return this.prisma
      .$transaction([
        this.prisma.user.findMany({
          where,
          skip,
          take,
          select: {
            // 指定查询的数据
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.user.count({
          where,
        }),
      ])
      .then(([users, total]) => {
        const totalPage = Math.ceil(total / take);
        return {
          success: true,
          pagination: {
            currentPage: parseInt(page),
            pageSize: take,
            total,
            totalPage,
            hasNextPage: parseInt(page) < totalPage,
            hasPreviousPage: parseInt(page) > 1,
          },
          data: users,
        };
      })
      .catch((error) => {
        return {
          success: false,
          message: '查询用户失败',
          error: error.message,
        };
      });
  }

  async searchUserBase(query: QueryUserDto) {
    const { page = '1', pageSize = '10', name, role } = query;
    // 计算分页参数
    // skip 跳过前 n 条记录 (分页偏移量)
    // 例如 第一页 page = 1 从第一条开始取
    // 第二页 page = 2 从第 11 条开始取
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    // take 取 n 条记录
    // 例如 take=10 表示取第 10 条记录
    const take = parseInt(pageSize);
    // 分页查询用户
    const users = await this.prisma.user.findMany({
      where: {
        name: name
          ? {
              contains: name,
            }
          : undefined,
        role: role || undefined,
      },
      // select: {
      //   // 指定查询的数据
      //   id: true,
      //   name: true,
      //   email: true,
      //   role: true,
      //   createdAt: true,
      //   updatedAt: true,
      // },
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
    // 统计总数
    // const total = await this.prisma.user.count({
    //   where: {
    //     name: name
    //       ? {
    //           contains: name,
    //         }
    //       : undefined,
    //     role: role || undefined,
    //   },
    // });
    return {
      success: true,
      total: users.length,
      message: '查询用户成功',
      data: users,
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

  updateUser1(id: string, user: User) {
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
}
