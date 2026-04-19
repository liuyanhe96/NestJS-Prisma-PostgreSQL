# NestJS + Prisma 7 + PostgreSQL 18 数据持久层实操文档
技术栈：NestJS · **Prisma 7** · PostgreSQL 18 Prisma 7 于 2025 年 11 月 19 日正式发布，当前最新版本 7.4.x 本文档基于 Prisma 7 全新架构编写，与 Prisma 6 有多处不兼容

---

## Prisma 7 vs Prisma 6 核心变化
| 对比项 | Prisma 6 | Prisma 7 |
| --- | --- | --- |
| 底层引擎 | Rust 二进制 | 纯 JavaScript（无 Rust 依赖） |
| schema generator | `provider = "prisma-client-js"` | `provider = "prisma-client"` |
| Client 生成位置 | `node_modules/@prisma/client` | 项目 `src/generated/prisma`<br/>（必须指定 output） |
| 数据库连接方式 | 直接连接，内置驱动 | **必须安装 Driver Adapter**（`@prisma/adapter-pg`<br/>） |
| 模块格式 | CommonJS | ESM（NestJS 用时需加 `moduleFormat = "cjs"`<br/>） |
| 配置文件 | 只有 `.env` | 新增 `prisma.config.ts`<br/> 管理连接 URL |
| Client 导入路径 | `import { PrismaClient } from '@prisma/client'` | `import { PrismaClient } from '../generated/prisma/client'` |


---

## 目录
1. 安装 PostgreSQL 18
2. 创建项目数据库
3. 安装 Prisma 7 依赖
4. 初始化 Prisma 7
5. 配置 prisma.config.ts
6. 配置 schema.prisma
7. 执行迁移
8. 封装 PrismaService（Prisma 7 新写法）
9. 用户模块完整 CRUD
10. 文章模块完整 CRUD（含关联查询）
11. Apifox 完整调试流程
12. Prisma 7 常用命令速查
13. 常见报错处理
14. 最终项目结构

---

## 一、安装 PostgreSQL 18
### macOS（Homebrew）
```bash
# 安装 PostgreSQL 18
brew install postgresql@18

# Apple Silicon Mac 加入 PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Intel Mac 加入 PATH
# echo 'export PATH="/usr/local/opt/postgresql@18/bin:$PATH"' >> ~/.zshrc

# 启动服务
brew services start postgresql@18

# 验证
psql --version
# 输出：psql (PostgreSQL) 18.x
```

macOS Homebrew 安装后，默认超级用户是**当前系统用户名**，可直接 `psql postgres` 登录，无需密码。

---

### Windows
1. 访问 https://www.postgresql.org/download/windows/
2. 下载 **PostgreSQL 18** Windows x86-64 安装包
3. 安装时设置 `postgres` 用户密码（**牢记**），端口保持 `5432`
4. 把 `C:\Program Files\PostgreSQL\18\bin` 加入系统环境变量 `Path`

---

### Linux（Ubuntu）
```bash
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc

sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'

sudo apt update && sudo apt install -y postgresql-18
sudo systemctl start postgresql && sudo systemctl enable postgresql
```

---

## 二、创建项目数据库
```bash
# 连接 PostgreSQL
psql -U postgres -h localhost

# 创建数据库
CREATE DATABASE nest_demo;

# 验证
\l

# 退出
\q
```

---

## 三、安装 Prisma 7 依赖
在 NestJS 项目根目录执行：

```bash
# Prisma CLI（开发依赖）
npm install prisma@latest --save-dev

# Prisma Client（运行时）
npm install @prisma/client@latest

# Prisma 7 必须安装的 PostgreSQL Driver Adapter（核心变化！）
# Prisma 7 移除了内置数据库驱动，必须手动安装 adapter
npm install @prisma/adapter-pg pg

# pg 的 TypeScript 类型定义
npm install @types/pg --save-dev
```

**Prisma 7 重要变化**：不再内置数据库驱动，连接 PostgreSQL 必须安装 `@prisma/adapter-pg` 和 `pg`。连 MySQL 要装 `@prisma/adapter-mariadb`，连 SQLite 要装 `@prisma/adapter-better-sqlite3`。

---

## 四、初始化 Prisma 7
```bash
# Prisma 7 初始化时必须指定 output 路径（与 v6 不同）
# --output 指定 Client 生成到项目 src 目录下，方便 TypeScript 识别
npx prisma init --output ../src/generated/prisma
```

执行后生成以下文件：

```plain
my-nest-demo/
├── prisma/
│   └── schema.prisma        ← 数据模型定义文件
├── prisma.config.ts         ← Prisma 7 新增的配置文件（数据库 URL 在这里配）
└── .env                     ← 环境变量（存放数据库密码等敏感信息）
```

**Prisma 7 新增**：`prisma.config.ts` 是 v7 的核心配置文件，数据库连接 URL 从 `.env` 移到了这里统一管理。

---

## 五、配置 prisma.config.ts
打开项目根目录的 `prisma.config.ts`，修改成：

```javascript
// prisma.config.ts
// Prisma 7 新增的核心配置文件
// 数据库连接 URL 在这里配置，不再写在 schema.prisma 的 datasource 里

import 'dotenv/config'    // 加载 .env 文件里的环境变量
import { defineConfig } from 'prisma/config'

export default defineConfig({
  // 指定 schema 文件位置
  schema: 'prisma/schema.prisma',

  // 迁移文件存放目录
  migrations: {
    path: 'prisma/migrations',
  },

  // 数据库连接配置
  // URL 从 .env 文件读取，不要硬编码在这里
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
})
```

打开 `.env` 文件，配置数据库连接字符串：

```json
# .env
# 格式：postgresql://用户名:密码@主机:端口/数据库名?schema=public

# Windows / Linux / macOS 安装包方式
DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/nest_demo?schema=public"

# macOS Homebrew 方式（用系统用户名，例如 john，通常无密码）
# DATABASE_URL="postgresql://john@localhost:5432/nest_demo?schema=public"
```

---

## 六、配置 schema.prisma
打开 `prisma/schema.prisma`，替换成以下完整内容：

```javascript
// prisma/schema.prisma

// ─────────────────────────────────────────────────────────
// generator 配置
// Prisma 7 核心变化：
//   provider 从 "prisma-client-js" 改为 "prisma-client"
//   output 必须指定，生成到项目 src 目录下
//   moduleFormat = "cjs" 是 NestJS 必须加的配置
//     原因：Prisma 7 默认生成 ESM 格式，而 NestJS 使用 CommonJS
//     不加这行会导致启动报错：Cannot use import statement in a module
// ─────────────────────────────────────────────────────────
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

// ─────────────────────────────────────────────────────────
// datasource 配置
// Prisma 7 变化：url 移到 prisma.config.ts 里配置
// 这里只保留 provider，不再写 url = env("DATABASE_URL")
// ─────────────────────────────────────────────────────────
datasource db {
  provider = "postgresql"
}

// ─────────────────────────────────────────────────────────
// User 模型 → 对应数据库 users 表
// ─────────────────────────────────────────────────────────
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]

  @@map("users")
}

// ─────────────────────────────────────────────────────────
// Post 模型 → 对应数据库 posts 表
// ─────────────────────────────────────────────────────────
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String   @db.Text
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@map("posts")
}
```

---

## 七、执行迁移
### 第一次迁移（建表）
```bash
npx prisma migrate dev --name init
```

成功后输出：

```bash
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "nest_demo"

Applying migration `20251130000000_init`

Your database is now in sync with your schema.

✔ Generated Prisma Client to ./src/generated/prisma
```

**注意**：Prisma 7 生成的 Client 在 `src/generated/prisma/` 目录下，不在 `node_modules` 里。

### 生成 Prisma Client（每次修改 schema 后执行）
```bash
npx prisma generate
```

### 打开可视化管理界面
```bash
npx prisma studio
# 浏览器打开 http://localhost:5555
```

---

## 八、封装 PrismaService（Prisma 7 新写法）
### 生成模块
```bash
nest g module prisma
nest g service prisma
```

### PrismaService（Prisma 7 写法）
```javascript
// src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'

// ⚠️ Prisma 7 重大变化：
// 不再从 '@prisma/client' 导入，而是从生成的路径导入
// 路径对应 schema.prisma 里 output = "../src/generated/prisma"
import { PrismaClient } from '../generated/prisma/client'

// ⚠️ Prisma 7 重大变化：
// 必须引入 Driver Adapter，Prisma 7 移除了内置数据库驱动
// @prisma/adapter-pg 是 PostgreSQL 的适配器
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

@Injectable()
  export class PrismaService extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {

    constructor() {
      // Prisma 7 必须通过 adapter 连接数据库
      // 第一步：创建 pg 连接池（Pool 负责管理数据库连接）
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      })

      // 第二步：把 pool 包装成 Prisma 认识的 adapter
      const adapter = new PrismaPg(pool)

      // 第三步：把 adapter 传给父类 PrismaClient
      // Prisma 7 的 PrismaClient 必须接收 adapter 参数，否则无法连接数据库
      super({ adapter })
    }

    // 模块初始化时建立数据库连接
    async onModuleInit() {
      await this.$connect()
      console.log('✅ PostgreSQL 18 数据库连接成功（Prisma 7）')
    }

    // 程序退出时断开连接，防止资源泄漏
    async onModuleDestroy() {
      await this.$disconnect()
      console.log('数据库连接已断开')
    }
  }
```

### PrismaModule
```javascript
// src/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

// @Global() 设置为全局模块
// 只要在 AppModule 里注册一次，全项目都能注入 PrismaService
@Global()
  @Module({
    providers: [PrismaService],
    exports: [PrismaService],
  })
  export class PrismaModule {}
```

### 更新 AppModule
```javascript
// src/app.module.ts

import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    PrismaModule,   // 注册全局 Prisma 模块
  ],
})
  export class AppModule {}
```

---

## 九、用户模块完整 CRUD
### 生成文件
```bash
nest g module user
nest g controller user
nest g service user
mkdir src/user/dto
```

### DTO 文件
```javascript
// src/user/dto/create-user.dto.ts
export class CreateUserDto {
  name: string
  email: string
  password: string
  role?: string
}
```

```javascript
// src/user/dto/update-user.dto.ts
export class UpdateUserDto {
  name?: string
  email?: string
  password?: string
  role?: string
}
```

```javascript
// src/user/dto/query-user.dto.ts
// 分页查询的请求参数结构
// 对应接口：GET /user/list?page=1&pageSize=10&name=大伟&role=admin
export class QueryUserDto {
  // 当前页码，不传默认第 1 页
  // URL 参数都是字符串，service 里会转成数字
  page?: string

  // 每页显示条数，不传默认 10 条
  pageSize?: string

  // 按用户名模糊搜索，可选
  // 例如传 "大伟"，会匹配所有名字包含"大伟"的用户
  name?: string

  // 按角色过滤，可选
  // 例如传 "admin"，只返回管理员用户
  role?: string
}
```

### UserService
```javascript
// src/user/user.service.ts

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { QueryUserDto } from './dto/query-user.dto'

@Injectable()
  export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── 创建用户 ──────────────────────────────────────────
    async create(dto: CreateUserDto) {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: dto.password,
          role: dto.role ?? 'user',
        },
      })
      return { success: true, data: user }
    }

    // ─── 分页查询用户列表（支持搜索过滤）─────────────────
    async findAll(query: QueryUserDto) {
      // URL 传来的参数都是字符串，这里转成数字并设默认值
      // page 不传则默认第 1 页
      const page = Number(query.page) || 1
      // pageSize 不传则默认每页 10 条，最大限制 100 防止一次查太多
      const pageSize = Math.min(Number(query.pageSize) || 10, 100)

      // skip：跳过前面多少条记录（分页偏移量）
      // 第 1 页：skip = (1-1) × 10 = 0，从第 1 条开始取
      // 第 2 页：skip = (2-1) × 10 = 10，从第 11 条开始取
      // 第 3 页：skip = (3-1) × 10 = 20，从第 21 条开始取
      const skip = (page - 1) * pageSize

      // 构建动态过滤条件
      // 使用 Prisma 的 where 对象，只有传了对应参数才加过滤条件
      const where: any = {}

      // name 搜索：模糊匹配，contains 相当于 SQL 的 LIKE '%xxx%'
      // mode: 'insensitive' 表示忽略大小写（PostgreSQL 专用配置）
      if (query.name) {
        where.name = {
          contains: query.name,
          mode: 'insensitive',
        }
      }

      // role 过滤：精确匹配
      if (query.role) {
        where.role = query.role
      }

      // 使用 prisma.$transaction 同时执行两个查询，保证在同一事务内
      // 好处：total 和 list 基于同一时刻的数据，不会因为并发写入导致数据不一致
      const [total, list] = await this.prisma.$transaction([

        // 第一个查询：统计满足条件的总记录数（用于前端计算总页数）
        // count 不受 skip/take 影响，统计的是全部满足 where 条件的数量
        this.prisma.user.count({ where }),

        // 第二个查询：查询当前页的数据列表
        this.prisma.user.findMany({
          where,         // 过滤条件（同上）
          skip,          // 跳过前面的记录
          take: pageSize, // 取当前页的数据条数
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            // password 字段不返回，保证安全
          },
          // 按创建时间降序排列，最新注册的用户在前面
          orderBy: { createdAt: 'desc' },
        }),
      ])

      // 计算总页数：向上取整
      // 例如 total=25，pageSize=10，则 totalPages = Math.ceil(25/10) = 3
      const totalPages = Math.ceil(total / pageSize)

      return {
        // 分页元信息：前端需要这些数据来渲染分页组件
        pagination: {
          page,           // 当前页码
          pageSize,       // 每页条数
          total,          // 总记录数
          totalPages,     // 总页数
          hasNext: page < totalPages,   // 是否有下一页
          hasPrev: page > 1,            // 是否有上一页
        },
        // 当前页的数据列表
        list,
      }
    }

    // ─── 查询单个用户（含文章列表）────────────────────────
    async findOne(id: number) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // 联表查询该用户的所有文章
        posts: {
          select: {
            id: true,
            title: true,
            published: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      return { success: false, message: `用户 ID ${id} 不存在` }
    }
    return { success: true, data: user }
  }

  // ─── 更新用户 ───────────────────────────────────────────
  async update(id: number, dto: UpdateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { id } })
    if (!exists) {
      return { success: false, message: `用户 ID ${id} 不存在` }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    })
    return { success: true, message: '更新成功', data: updated }
  }

  // ─── 删除用户 ───────────────────────────────────────────
  async remove(id: number) {
    const exists = await this.prisma.user.findUnique({ where: { id } })
    if (!exists) {
      return { success: false, message: `用户 ID ${id} 不存在` }
    }

    // onDelete: Cascade 配置使删除用户时自动级联删除其文章
    await this.prisma.user.delete({ where: { id } })
    return { success: true, message: `用户 ID ${id} 已删除` }
  }
}
```

### UserController
```javascript
// src/user/user.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common'
import { UserService } from './user.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { QueryUserDto } from './dto/query-user.dto'

@Controller('user')
  export class UserController {
    constructor(private readonly userService: UserService) {}

    // POST /user/create → 创建用户
    @Post('create')
    create(@Body() dto: CreateUserDto) {
      return this.userService.create(dto)
    }

    // GET /user/list                           → 查询第 1 页，每页 10 条
    // GET /user/list?page=2&pageSize=5         → 查询第 2 页，每页 5 条
    // GET /user/list?name=大伟                  → 按名字模糊搜索
    // GET /user/list?role=admin                → 只查管理员
    // GET /user/list?page=1&pageSize=10&name=大伟&role=admin → 组合查询
    @Get('list')
    findAll(
      // @Query() 把 URL 中所有 query 参数解析成 QueryUserDto 对象
      // 例如 ?page=2&pageSize=5&name=大伟 → { page: '2', pageSize: '5', name: '大伟' }
      @Query() query: QueryUserDto,
    ) {
      return this.userService.findAll(query)
    }

    // GET /user/1 → 查询单个用户（含文章列表）
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
      return this.userService.findOne(id)
    }

    // PUT /user/1 → 更新用户
    @Put(':id')
    update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdateUserDto,
    ) {
      return this.userService.update(id, dto)
    }

    // DELETE /user/1 → 删除用户
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
      return this.userService.remove(id)
    }
  }
```

### UserModule
```javascript
// src/user/user.module.ts

import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
  export class UserModule {}
```

---

## 十、文章模块完整 CRUD（含关联查询）
### 生成文件
```bash
nest g module post
nest g controller post
nest g service post
mkdir src/post/dto
```

### DTO 文件
```javascript
// src/post/dto/create-post.dto.ts
export class CreatePostDto {
  title: string
  content: string
  published?: boolean
  authorId: number
}
```

```javascript
// src/post/dto/update-post.dto.ts
export class UpdatePostDto {
  title?: string
  content?: string
  published?: boolean
}
```

### PostService
```javascript
// src/post/post.service.ts

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePostDto } from './dto/create-post.dto'
import { UpdatePostDto } from './dto/update-post.dto'

@Injectable()
  export class PostService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── 创建文章 ──────────────────────────────────────────
    async create(dto: CreatePostDto) {
      const author = await this.prisma.user.findUnique({
        where: { id: dto.authorId },
      })
      if (!author) {
        return { success: false, message: `用户 ID ${dto.authorId} 不存在` }
      }

      const post = await this.prisma.post.create({
        data: {
          title: dto.title,
          content: dto.content,
          published: dto.published ?? false,
          author: { connect: { id: dto.authorId } },
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      })
      return { success: true, data: post }
    }

    // ─── 查询所有文章（含作者信息）────────────────────────
    async findAll(published?: boolean) {
      const posts = await this.prisma.post.findMany({
        where: published !== undefined ? { published } : {},
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return { total: posts.length, list: posts }
    }

    // ─── 查询单篇文章 ───────────────────────────────────────
    async findOne(id: number) {
      const post = await this.prisma.post.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
        },
      })
      if (!post) {
        return { success: false, message: `文章 ID ${id} 不存在` }
      }
      return { success: true, data: post }
    }

    // ─── 更新文章 ───────────────────────────────────────────
    async update(id: number, dto: UpdatePostDto) {
      const exists = await this.prisma.post.findUnique({ where: { id } })
      if (!exists) {
        return { success: false, message: `文章 ID ${id} 不存在` }
      }

      const updated = await this.prisma.post.update({
        where: { id },
        data: dto,
        include: { author: { select: { id: true, name: true } } },
      })
      return { success: true, message: '更新成功', data: updated }
    }

    // ─── 切换发布状态 ───────────────────────────────────────
    async togglePublish(id: number) {
      const post = await this.prisma.post.findUnique({ where: { id } })
      if (!post) {
        return { success: false, message: `文章 ID ${id} 不存在` }
      }

      const updated = await this.prisma.post.update({
        where: { id },
        data: { published: !post.published },
      })
      return {
        success: true,
        message: updated.published ? '文章已发布' : '文章已取消发布',
        data: updated,
      }
    }

    // ─── 删除文章 ───────────────────────────────────────────
    async remove(id: number) {
      const exists = await this.prisma.post.findUnique({ where: { id } })
      if (!exists) {
        return { success: false, message: `文章 ID ${id} 不存在` }
    }

    await this.prisma.post.delete({ where: { id } })
    return { success: true, message: `文章 ID ${id} 已删除` }
  }

  // ─── 查询某用户的所有文章 ───────────────────────────────
  async findByAuthor(authorId: number) {
    const posts = await this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
    })
    return { total: posts.length, list: posts }
  }
}
```

### PostController
```javascript
// src/post/post.controller.ts

import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, ParseIntPipe,
} from '@nestjs/common'
import { PostService } from './post.service'
import { CreatePostDto } from './dto/create-post.dto'
import { UpdatePostDto } from './dto/update-post.dto'

@Controller('post')
  export class PostController {
    constructor(private readonly postService: PostService) {}

    @Post('create')
    create(@Body() dto: CreatePostDto) {
      return this.postService.create(dto)
    }

    // GET /post/list?published=true|false
    @Get('list')
    findAll(@Query('published') published?: string) {
      const filter =
        published === 'true' ? true
        : published === 'false' ? false
        : undefined
      return this.postService.findAll(filter)
    }

    // 注意：author/:authorId 路由必须放在 :id 前面，否则路由匹配会出错
    @Get('author/:authorId')
    findByAuthor(@Param('authorId', ParseIntPipe) authorId: number) {
      return this.postService.findByAuthor(authorId)
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
      return this.postService.findOne(id)
    }

    @Put(':id')
    update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdatePostDto,
    ) {
      return this.postService.update(id, dto)
    }

    @Patch(':id/publish')
    togglePublish(@Param('id', ParseIntPipe) id: number) {
      return this.postService.togglePublish(id)
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
      return this.postService.remove(id)
    }
  }
```

### PostModule
```javascript
// src/post/post.module.ts

import { Module } from '@nestjs/common'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  controllers: [PostController],
  providers: [PostService],
})
  export class PostModule {}
```

### 最终 AppModule
```javascript
// src/app.module.ts

import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { UserModule } from './user/user.module'
import { PostModule } from './post/post.module'

@Module({
  imports: [
    PrismaModule,  // 全局 Prisma（只注册一次）
    UserModule,    // 用户模块
    PostModule,    // 文章模块
  ],
})
  export class AppModule {}
```

---

## 十一、Apifox 完整调试流程
启动服务：

```bash
npm run start:dev
```

终端看到 `✅ PostgreSQL 18 数据库连接成功（Prisma 7）` 再开始测试。

---

### 用户接口
#### 第一步：批量创建测试数据（方便演示分页效果）
先多创建几个用户，数据多了分页才有意义：

```plain
POST http://localhost:3000/user/create
```

依次创建以下用户（每次修改 name 和 email 发送）：

```json
{ "name": "大伟老师", "email": "dawei@example.com", "password": "123456", "role": "admin" }
```

```json
{ "name": "大伟助手", "email": "dawei2@example.com", "password": "123456", "role": "admin" }
```

```json
{ "name": "小明", "email": "xiaoming@example.com", "password": "654321" }
```

```json
{ "name": "小红", "email": "xiaohong@example.com", "password": "654321" }
```

```json
{ "name": "小张", "email": "xiaozhang@example.com", "password": "654321" }
```

```json
{ "name": "小李", "email": "xiaoli@example.com", "password": "654321" }
```

```json
{ "name": "小王", "email": "xiaowang@example.com", "password": "654321" }
```

---

#### 第二步：基础分页查询
**默认查询（第 1 页，每页 10 条）：**

```plain
GET http://localhost:3000/user/list
```

**返回示例：**

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 7,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "list": [
    { "id": 7, "name": "小王", "email": "xiaowang@example.com", "role": "user", "createdAt": "..." },
    { "id": 6, "name": "小李", "email": "xiaoli@example.com", "role": "user", "createdAt": "..." }
  ]
}
```

---

#### 第三步：指定页码和每页条数
**查询第 1 页，每页 3 条：**

```plain
GET http://localhost:3000/user/list?page=1&pageSize=3
```

**返回示例：**

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 3,
    "total": 7,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "list": [
    { "id": 7, "name": "小王", "role": "user" },
    { "id": 6, "name": "小李", "role": "user" },
    { "id": 5, "name": "小张", "role": "user" }
  ]
}
```

**查询第 2 页，每页 3 条：**

```plain
GET http://localhost:3000/user/list?page=2&pageSize=3
```

**返回示例：**

```json
{
  "pagination": {
    "page": 2,
    "pageSize": 3,
    "total": 7,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  },
  "list": [
    { "id": 4, "name": "小红", "role": "user" },
    { "id": 3, "name": "小明", "role": "user" },
    { "id": 2, "name": "大伟助手", "role": "admin" }
  ]
}
```

**查询最后一页（第 3 页，每页 3 条）：**

```plain
GET http://localhost:3000/user/list?page=3&pageSize=3
```

**返回示例：**

```json
{
  "pagination": {
    "page": 3,
    "pageSize": 3,
    "total": 7,
    "totalPages": 3,
    "hasNext": false,
    "hasPrev": true
  },
  "list": [
    { "id": 1, "name": "大伟老师", "role": "admin" }
  ]
}
```

视频录制重点：对比三次请求的 `hasNext` 和 `hasPrev` 变化，直观展示分页逻辑。

---

#### 第四步：按名字模糊搜索
**搜索名字包含"大伟"的用户：**

```plain
GET http://localhost:3000/user/list?name=大伟
```

**返回示例（忽略大小写，只返回名字含"大伟"的用户）：**

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "list": [
    { "id": 2, "name": "大伟助手", "role": "admin" },
    { "id": 1, "name": "大伟老师", "role": "admin" }
  ]
}
```

**搜索名字包含"小"的用户：**

```plain
GET http://localhost:3000/user/list?name=小
```

---

#### 第五步：按角色过滤
**只查管理员：**

```plain
GET http://localhost:3000/user/list?role=admin
```

**只查普通用户：**

```plain
GET http://localhost:3000/user/list?role=user
```

---

#### 第六步：组合查询（分页 + 搜索 + 过滤）
**搜索名字含"大伟"的管理员，每页 5 条，查第 1 页：**

```plain
GET http://localhost:3000/user/list?page=1&pageSize=5&name=大伟&role=admin
```

所有参数可以任意组合，没传的参数就不加对应的过滤条件。

---

#### 第七步：查询单个用户（含文章列表）
```plain
GET http://localhost:3000/user/1
```

#### 第八步：更新用户
```plain
PUT http://localhost:3000/user/1
```

```json
{ "name": "大伟老师（已更新）" }
```

#### 第九步：删除用户
```plain
DELETE http://localhost:3000/user/7
```

---

### 文章接口
#### POST /post/create — 创建文章（草稿）
```plain
POST http://localhost:3000/post/create
```

```json
{
  "title": "Vue3 Composition API 详解",
  "content": "Composition API 是 Vue3 最重要的新特性...",
  "published": false,
  "authorId": 1
}
```

#### POST /post/create — 创建文章（已发布）
```json
{
  "title": "NestJS + Prisma 7 实战教程",
  "content": "Prisma 7 移除了 Rust 引擎，改用纯 JavaScript 实现...",
  "published": true,
  "authorId": 1
}
```

#### GET /post/list — 查询所有文章
```plain
GET http://localhost:3000/post/list
GET http://localhost:3000/post/list?published=true
GET http://localhost:3000/post/list?published=false
```

#### GET /post/:id — 查询单篇（含作者信息）
```plain
GET http://localhost:3000/post/1
```

返回示例：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Vue3 Composition API 详解",
    "published": false,
    "authorId": 1,
    "author": {
      "id": 1,
      "name": "大伟老师",
      "email": "dawei@example.com",
      "role": "admin"
    }
  }
}
```

#### GET /post/author/:authorId — 查询某用户的文章
```plain
GET http://localhost:3000/post/author/1
```

#### PUT /post/:id — 更新文章
```plain
PUT http://localhost:3000/post/1
```

```json
{ "title": "Vue3 Composition API 详解（2025 最新版）" }
```

#### PATCH /post/:id/publish — 切换发布状态
```plain
PATCH http://localhost:3000/post/1/publish
```

无需 Body，每次调用切换一次 published 状态。

#### DELETE /post/:id — 删除文章
```plain
DELETE http://localhost:3000/post/1
```

---

## 十二、Prisma 7 常用命令速查
| 命令 | 作用 | 何时使用 |
| --- | --- | --- |
| `npx prisma init --output ../src/generated/prisma` | 初始化 Prisma 7 | 项目第一次引入 Prisma |
| `npx prisma migrate dev --name 描述` | 创建并执行迁移 | 每次修改 schema.prisma 后 |
| `npx prisma generate` | 重新生成 Prisma Client | migrate 后类型没更新时 |
| `npx prisma migrate deploy` | 生产环境执行迁移 | 部署到服务器时 |
| `npx prisma studio` | 打开可视化管理界面 | 查看 / 编辑数据库数据 |
| `npx prisma db push` | 直接同步 schema（不生成迁移文件） | 原型阶段快速测试 |
| `npx prisma format` | 格式化 schema.prisma | 整理代码风格 |
| `npx prisma validate` | 验证 schema 语法是否正确 | 修改 schema 后检查 |


---

## 十三、常见报错处理
### 报错 1：Cannot use import statement in a module
```plain
SyntaxError: Cannot use import statement in a module
```

原因：忘记在 `schema.prisma` 的 generator 里加 `moduleFormat = "cjs"`。

解决：在 `schema.prisma` 的 generator 块加上：

```plain
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"   ← 加这行
}
```

然后重新执行 `npx prisma generate`。

---

### 报错 2：PrismaClient 导入路径错误
```plain
Module '"@prisma/client"' has no exported member 'PrismaClient'
```

原因：Prisma 7 的 Client 生成在项目目录里，不在 `@prisma/client`。

解决：修改导入路径：

```plain
// ❌ 错误（Prisma 6 写法）
import { PrismaClient } from '@prisma/client'

// ✅ 正确（Prisma 7 写法）
import { PrismaClient } from '../generated/prisma/client'
```

---

### 报错 3：PrismaClient 缺少 adapter 参数
```plain
Error: PrismaClient requires a driver adapter in Prisma 7
```

原因：Prisma 7 必须传入 adapter，不能像 v6 一样直接 `new PrismaClient()`。

解决：按本文档的 PrismaService 写法，通过 `PrismaPg` + `Pool` 创建 adapter 后传入。

---

### 报错 4：无法连接数据库
```plain
Error: P1001: Can't reach database server at localhost:5432
```

原因：PostgreSQL 服务未启动。

解决：

```bash
# macOS
brew services start postgresql@18
# Linux
sudo systemctl start postgresql
# Windows：在「服务」里启动 postgresql-x64-18
```

---

### 报错 5：数据库不存在
```plain
Error: P1003: Database nest_demo does not exist
```

解决：

```bash
psql -U postgres -h localhost
CREATE DATABASE nest_demo;
\q
```

---

### 报错 6：唯一性冲突
```plain
Error: P2002: Unique constraint failed on the fields: (email)
```

原因：插入了重复的 email。解决：换一个不重复的邮箱。

---

### 报错 7：prisma.config.ts 加载失败
```plain
Failed to load config file: prisma.config.ts
```

原因：忘记在 `prisma.config.ts` 顶部加 `import 'dotenv/config'`，或者 `dotenv` 没安装。

解决：

```bash
npm install dotenv
```

并确认 `prisma.config.ts` 第一行是 `import 'dotenv/config'`。

---

## 十四、最终项目结构
```bash
my-nest-demo/
├── src/
│   ├── generated/
│   │   └── prisma/               ← Prisma 7 生成的 Client（不要手动修改）
│   │       ├── client.ts
│   │       └── ...
│   ├── prisma/
│   │   ├── prisma.module.ts      ← @Global() 全局模块
│   │   └── prisma.service.ts     ← Prisma 7 新写法（含 PrismaPg adapter）
│   ├── user/
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.module.ts
│   ├── post/
│   │   ├── dto/
│   │   │   ├── create-post.dto.ts
│   │   │   └── update-post.dto.ts
│   │   ├── post.controller.ts
│   │   ├── post.service.ts
│   │   └── post.module.ts
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   ├── schema.prisma             ← 数据模型（generator 用 prisma-client）
│   └── migrations/               ← 自动生成的迁移 SQL，不要手动改
├── prisma.config.ts              ← Prisma 7 新增：数据库 URL 在这里配置
├── .env                          ← 环境变量（数据库密码等，不提交 Git）
├── package.json
└── tsconfig.json
```

---

## 附：Prisma 6 → Prisma 7 迁移对照表
如果你之前用的是 Prisma 6，以下是需要修改的地方：

| 位置 | Prisma 6 写法 | Prisma 7 写法 |
| --- | --- | --- |
| 安装包 | `npm i @prisma/client` | `npm i @prisma/client @prisma/adapter-pg pg` |
| `schema.prisma`<br/> generator provider | `"prisma-client-js"` | `"prisma-client"` |
| `schema.prisma`<br/> generator output | 不需要 | `output = "../src/generated/prisma"` |
| `schema.prisma`<br/> generator moduleFormat | 不需要 | `moduleFormat = "cjs"` |
| `schema.prisma`<br/> datasource url | `url = env("DATABASE_URL")` | 移到 `prisma.config.ts`<br/>，datasource 只保留 provider |
| `prisma.config.ts` | 不存在 | 新增，配置 datasource.url |
| PrismaClient 导入路径 | `from '@prisma/client'` | `from '../generated/prisma/client'` |
| PrismaService 构造函数 | `super()`<br/> 不需要参数 | 必须传 `super({ adapter })`<br/>，adapter 用 PrismaPg 创建 |

