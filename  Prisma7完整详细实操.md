# Prisma 7 完整详细介绍
版本：Prisma 7（2025 年 11 月 19 日发布） 数据库：PostgreSQL 18 包含：配置文件详解 · 模型创建 · 关联关系 · 主键外键 · 自动建表原理

---

## 目录
1. Prisma 7 整体架构
2. 安装和初始化
3. prisma.config.ts 详解
4. schema.prisma 详解
5. 数据类型完整列表
6. 字段修饰符（@装饰器）详解
7. 模型之间的关联关系
8. 主键和外键
9. 模型和数据库表的关系
10. 模型是否自动生成数据库表
11. 完整实战 Schema 示例
12. Prisma Client 查询常用写法

---

## 一、Prisma 7 整体架构
Prisma 由三个部分组成，各自职责独立：

```markdown
┌─────────────────────────────────────────────────────────┐
│                      你的 NestJS 代码                     │
│         this.prisma.user.findMany({ where: ... })        │
└────────────────────────┬────────────────────────────────┘
                         │ 调用
┌────────────────────────▼────────────────────────────────┐
│                   Prisma Client（v7）                     │
│         纯 JavaScript 实现（移除了 Rust 引擎）             │
│         根据 schema 自动生成，有完整 TypeScript 类型        │
│         生成位置：src/generated/prisma/                   │
└────────────────────────┬────────────────────────────────┘
                         │ 通过 Driver Adapter 连接
┌────────────────────────▼────────────────────────────────┐
│              @prisma/adapter-pg（Driver Adapter）         │
│         Prisma 7 新增，作为 Prisma 和数据库驱动的桥梁       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                     pg（数据库驱动）                       │
│                   负责实际的 TCP 连接                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   PostgreSQL 18 数据库                    │
└─────────────────────────────────────────────────────────┘
```

**Prisma 的三个核心工具：**

| 工具 | 文件 / 命令 | 作用 |
| --- | --- | --- |
| Prisma Schema | `prisma/schema.prisma` | 定义数据模型（相当于画表结构图） |
| Prisma Migrate | `npx prisma migrate dev` | 把 Schema 同步到数据库（自动建表） |
| Prisma Client | `src/generated/prisma/` | 自动生成的查询 API，有完整类型提示 |


---

## 二、安装和初始化
### 安装依赖
```bash
# Prisma CLI（开发依赖）
pnpm install prisma@latest --save-dev

# Prisma Client 运行时
pnpm install @prisma/client@latest

# PostgreSQL Driver Adapter（Prisma 7 必须安装）
pnpm install @prisma/adapter-pg pg

# pg 的 TypeScript 类型
pnpm install @types/pg --save-dev
```

### 初始化
```bash
# --output 指定 Client 生成到 src 目录，Prisma 7 必须指定
npx prisma init --output ../src/generated/prisma
```

执行后生成的文件：

```plain
项目根目录/
├── prisma/
│   └── schema.prisma        ← 数据模型定义（核心文件）
├── prisma.config.ts         ← Prisma 7 新增：配置数据库连接 URL
└── .env                     ← 环境变量（存数据库密码等）
```

---

## 三、prisma.config.ts 详解
`prisma.config.ts` 是 Prisma 7 新增的配置文件，用来管理数据库连接信息。

在 Prisma 6 里，数据库 URL 写在 `schema.prisma` 的 `datasource` 块里：

```json
# Prisma 6 旧写法（不再推荐）
datasource db {
  url = env("DATABASE_URL")
}
```

Prisma 7 把 URL 移到了专门的配置文件里统一管理：

```javascript
// prisma.config.ts
// 完整注释版

// 必须放在第一行，加载 .env 文件里的环境变量
// 这样 process.env.DATABASE_URL 才能读取到 .env 里的值
import 'dotenv/config'

// defineConfig 是 Prisma 7 提供的配置函数，有完整的 TypeScript 类型提示
import { defineConfig } from 'prisma/config'

export default defineConfig({

  // ── schema 文件路径 ──────────────────────────────────────
  // 告诉 Prisma CLI 去哪里找数据模型定义文件
  // 相对于 prisma.config.ts 所在目录（项目根目录）
  schema: 'prisma/schema.prisma',

  // ── 迁移文件存放目录 ─────────────────────────────────────
  // 每次执行 prisma migrate dev，生成的 SQL 文件存放在这里
  // 这些文件记录了每次数据库结构变更的历史
  migrations: {
    path: 'prisma/migrations',
  },

  // ── 数据库连接配置 ───────────────────────────────────────
  datasource: {
    // 数据库连接字符串，从 .env 文件读取
    // 格式：postgresql://用户名:密码@主机:端口/数据库名?schema=public
    url: process.env.DATABASE_URL as string,
  },
})
```

对应的 `.env` 文件：

```json
# .env
# 这个文件存放敏感配置，不要提交到 Git

# PostgreSQL 连接字符串
# 格式说明：
#   postgresql://  协议，固定写法
#   postgres       数据库用户名（安装时设置的）
#   :123456        密码（安装时设置的）
#   @localhost     数据库主机地址（本机就是 localhost）
#   :5432          PostgreSQL 默认端口
#   /nest_demo     数据库名（提前用 CREATE DATABASE 创建好）
#   ?schema=public 使用 public schema（PostgreSQL 的默认 schema）
DATABASE_URL="postgresql://postgres:123456@localhost:5432/nest_demo?schema=public"
```

---

## 四、schema.prisma 详解
`schema.prisma` 是 Prisma 的核心文件，所有数据模型都在这里定义。

```javascript
// prisma/schema.prisma

// ══════════════════════════════════════════════════════════
// 第一部分：generator（客户端生成配置）
// ══════════════════════════════════════════════════════════
// 告诉 Prisma 执行 prisma generate 时生成什么
generator client {

  // provider = "prisma-client" 是 Prisma 7 的新写法
  // Prisma 6 是 "prisma-client-js"
  // 区别：Prisma 7 用纯 JS 实现，不依赖 Rust 二进制文件
  provider = "prisma-client"

  // output 指定生成的 Client 代码放到哪里
  // Prisma 7 必须指定，不再默认生成到 node_modules
  // 路径相对于 schema.prisma 文件所在目录（prisma/）
  // ../src/generated/prisma 相当于项目根目录的 src/generated/prisma
  output = "../src/generated/prisma"

  // moduleFormat 指定生成的代码格式
  // "cjs" = CommonJS，NestJS 默认使用 CommonJS，必须写这行
  // 如果不写，Prisma 7 默认生成 ESM 格式，NestJS 运行会报错
  moduleFormat = "cjs"
}

// ══════════════════════════════════════════════════════════
// 第二部分：datasource（数据库连接配置）
// ══════════════════════════════════════════════════════════
// 告诉 Prisma 使用什么数据库
datasource db {

  // provider 指定数据库类型
  // 可选值：postgresql | mysql | sqlite | sqlserver | mongodb
  provider = "postgresql"

  // Prisma 7 变化：url 移到 prisma.config.ts 里配置
  // 这里不再写 url = env("DATABASE_URL")
  // datasource 块只保留 provider 即可
}

// ══════════════════════════════════════════════════════════
// 第三部分：model（数据模型定义）
// ══════════════════════════════════════════════════════════
// 每个 model 对应数据库里的一张表
model User {
  // 字段名   数据类型   修饰符
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String
}
```

---

## 五、数据类型完整列表
Prisma 提供的数据类型会自动映射到 PostgreSQL 对应的列类型：

| Prisma 类型 | PostgreSQL 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `String` | `TEXT` | 文本，无长度限制 | 名字、邮箱、内容 |
| `String @db.VarChar(255)` | `VARCHAR(255)` | 有长度限制的文本 | 用户名最长 255 |
| `String @db.Text` | `TEXT` | 长文本（语义更清晰） | 文章内容 |
| `String @db.Char(6)` | `CHAR(6)` | 固定长度字符 | 验证码 |
| `Int` | `INTEGER` | 32 位整数 | 数量、年龄 |
| `BigInt` | `BIGINT` | 64 位整数 | 超大数字 |
| `Float` | `DOUBLE PRECISION` | 浮点数 | 评分 |
| `Decimal` | `DECIMAL` | 精确小数（金融用） | 价格、金额 |
| `Boolean` | `BOOLEAN` | 布尔值 true/false | 是否发布 |
| `DateTime` | `TIMESTAMP(3)` | 日期时间 | 创建时间 |
| `Json` | `JSONB` | JSON 数据 | 配置项、元数据 |
| `Bytes` | `BYTEA` | 二进制数据 | 文件内容 |


### 实际使用示例
```javascript
model Product {
  id          Int      @id @default(autoincrement())

  // 普通文本，PostgreSQL 存为 TEXT
  name        String

  // 限制最大长度为 100 个字符
  sku         String   @db.VarChar(100)

  // 长文本，适合存商品详情
  description String   @db.Text

  // 精确小数，@db.Decimal(10, 2) 表示最多 10 位，小数点后 2 位
  // 价格存 Decimal 不会有浮点精度问题（Float 会有）
  price       Decimal  @db.Decimal(10, 2)

  // 库存数量，整数
  stock       Int      @default(0)

  // 评分，浮点数
  rating      Float    @default(0.0)

  // 是否上架
  isActive    Boolean  @default(true)

  // 商品创建时间
  createdAt   DateTime @default(now())

  // 商品图片列表，用 JSON 存储图片 URL 数组
  images      Json     @default("[]")
}
```

---

## 六、字段修饰符（@装饰器）详解
字段修饰符写在字段类型后面，用来设置约束、默认值、索引等。

### 6.1 主键相关
```javascript
model User {
  // @id 标记为主键
  // 一张表只能有一个 @id 字段
  id  Int  @id

  // @id 通常配合 @default 使用
  // autoincrement() = 自增整数（1, 2, 3, 4...）
  id  Int  @id @default(autoincrement())

  // uuid() = 随机生成 UUID 字符串
  // 例如：'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  // 适合分布式系统，不会因为 ID 连续而暴露数据量
  id  String  @id @default(uuid())

  // cuid() = 生成唯一的短字符串
  // 例如：'clh123abc456def'
  id  String  @id @default(cuid())
}
```

### 6.2 唯一约束
```javascript
model User {
  id    Int    @id @default(autoincrement())

  // @unique 该字段值全表唯一，不能重复
  // 插入重复值时 Prisma 会抛出 P2002 错误
  email String @unique

  // @@unique 多字段组合唯一（放在模型底部）
  // 含义：firstName + lastName 的组合不能重复
  // 但单独 firstName 或 lastName 可以重复
  firstName String
  lastName  String

  @@unique([firstName, lastName])
}
```

### 6.3 默认值
```javascript
model Post {
  id Int @id @default(autoincrement())

  // 字符串默认值
  status    String   @default("draft")

  // 数字默认值
  viewCount Int      @default(0)

  // 布尔默认值
  published Boolean  @default(false)

  // 时间默认值：now() 表示插入时取当前时间
  createdAt DateTime @default(now())

  // @updatedAt：每次 update 操作时自动更新为当前时间
  // 不需要在代码里手动传这个字段
  updatedAt DateTime @updatedAt
}
```

### 6.4 索引
```javascript
model Article {
  id        Int    @id @default(autoincrement())
  title     String
  status    String
  authorId  Int
  createdAt DateTime @default(now())

  // @@index 给字段加索引，提升查询性能
  // 适合经常作为 where 条件的字段
  @@index([authorId])

  // 多字段组合索引
  @@index([status, createdAt])
}
```

### 6.5 可选字段
```javascript
model User {
  id      Int     @id @default(autoincrement())
  name    String          // 必填，不能为 null
  avatar  String?         // ? 表示可选，可以为 null
  phone   String?         // 插入时不传这个字段也不报错
  bio     String?  @db.Text  // 可选 + 指定数据库类型
}
```

### 6.6 模型级别修饰符
```javascript
model User {
  id        Int    @id @default(autoincrement())
  firstName String
  lastName  String
  email     String

  // @@map 指定数据库表名
  // 如果不写，默认表名就是模型名（User），区分大小写
  // 写了 @@map("users")，数据库里的表名就是 users（小写）
  @@map("users")

  // @@unique 多字段组合唯一约束
  @@unique([firstName, lastName])

  // @@index 多字段索引
  @@index([email])
}
```

---

## 七、模型之间的关联关系
### 7.1 一对多关系（1:N）— 最常见
**场景：一个用户可以写多篇文章，一篇文章只属于一个用户。**

```javascript
// 一对多：User（一）→ Post（多）

model User {
  id    Int    @id @default(autoincrement())
  name  String
  email String @unique

  // posts 字段：声明这个用户可以关联多篇文章
  // Post[] 表示数组，这不是真实的数据库列
  // 只是 Prisma 用来做关联查询的声明
  // 数据库里 users 表不会有 posts 这一列
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  content  String @db.Text

  // authorId 是真实存在于数据库的外键列
  // 存储关联用户的 id 值
  authorId Int

  // author 字段：声明关联关系
  //   fields: [authorId]       本表（posts）用哪个字段做外键
  //   references: [id]         关联到 User 表的哪个字段
  //   onDelete: Cascade        删除用户时，该用户的文章也自动删除
  //   onDelete: Restrict       如果用户有文章，拒绝删除用户（默认）
  //   onDelete: SetNull        删除用户时，文章的 authorId 设为 null
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@map("posts")
}
```

**生成的数据库表结构：**

```sql
-- users 表（无 posts 列）
CREATE TABLE "users" (
  "id"    SERIAL PRIMARY KEY,
  "name"  TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE
);

-- posts 表（有 author_id 外键列）
CREATE TABLE "posts" (
  "id"       SERIAL PRIMARY KEY,
  "title"    TEXT NOT NULL,
  "content"  TEXT NOT NULL,
  "authorId" INTEGER NOT NULL,
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
);
```

**查询写法：**

```javascript
// 查询用户时，同时获取其所有文章（联表查询）
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true },     // 联表获取文章列表
})
// user.posts → Post 数组

// 查询文章时，同时获取作者信息
const post = await prisma.post.findUnique({
  where: { id: 1 },
  include: { author: true },    // 联表获取作者信息
})
// post.author → User 对象

// 创建文章时，关联到已有用户
const post = await prisma.post.create({
  data: {
    title: '文章标题',
    content: '内容',
    author: { connect: { id: 1 } },  // 关联 id=1 的用户
  },
})
```

---

### 7.2 一对一关系（1:1）
**场景：一个用户对应一个用户详情，一个详情只属于一个用户。**

```javascript
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  name    String

  // profile 字段：声明一对一关联
  // UserProfile? 末尾的 ? 表示详情可选（用户可以没有详情）
  profile UserProfile?
}

model UserProfile {
  id     Int    @id @default(autoincrement())
  bio    String? @db.Text    // 个人简介（可选）
  avatar String?             // 头像 URL（可选）
  phone  String?             // 手机号（可选）

  // 外键字段：关联 User 的 id
  userId Int   @unique       // @unique 保证一对一（每个 userId 只能出现一次）

  // 关联声明
  user   User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

**查询写法：**

```javascript
// 查询用户时，同时获取详情
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { profile: true },
})
// user.profile → UserProfile 对象 或 null

// 创建用户详情，关联到用户
const profile = await prisma.userProfile.create({
  data: {
    bio: '前端开发者',
    avatar: 'https://example.com/avatar.jpg',
    user: { connect: { id: 1 } },
  },
})
```

---

### 7.3 多对多关系（N:N）
**场景：一篇文章可以有多个标签，一个标签可以属于多篇文章。**

#### 方式一：隐式多对多（Prisma 自动管理中间表）
```javascript
model Post {
  id   Int    @id @default(autoincrement())
  title String

  // tags 字段：声明多对多关联
  // Tag[] 表示关联多个标签
  tags Tag[]

  @@map("posts")
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique

  // posts 字段：声明反向关联
  // Post[] 表示一个标签可以关联多篇文章
  posts Post[]

  @@map("tags")
}
```

Prisma 会自动创建一张名为 `_PostToTag` 的中间表，不需要手动定义。

**查询写法：**

```javascript
// 创建文章时，同时关联多个标签
const post = await prisma.post.create({
  data: {
    title: '文章标题',
    tags: {
      connect: [
        { id: 1 },   // 关联 id=1 的标签
        { id: 2 },   // 关联 id=2 的标签
      ],
    },
  },
})

// 查询文章时，同时获取所有标签
const post = await prisma.post.findUnique({
  where: { id: 1 },
  include: { tags: true },
})
// post.tags → Tag 数组
```

---

#### 方式二：显式多对多（手动定义中间表）
**适合需要在中间表存额外字段的场景，比如学生选课时要存分数。**

```javascript
model Student {
  id          Int           @id @default(autoincrement())
  name        String

  // 通过中间模型 Enrollment 关联课程
  enrollments Enrollment[]

  @@map("students")
}

model Course {
  id          Int           @id @default(autoincrement())
  title       String

  // 通过中间模型 Enrollment 关联学生
  enrollments Enrollment[]

  @@map("courses")
}

// 中间表：学生选课记录
model Enrollment {
  id          Int      @id @default(autoincrement())

  // 外键：关联学生
  studentId   Int
  student     Student  @relation(fields: [studentId], references: [id])

  // 外键：关联课程
  courseId    Int
  course      Course   @relation(fields: [courseId], references: [id])

  // 中间表可以存额外字段
  score       Float?           // 分数
  enrolledAt  DateTime @default(now())   // 选课时间
  status      String   @default("active")  // 状态

  // 联合唯一：同一个学生不能重复选同一门课
  @@unique([studentId, courseId])

  @@map("enrollments")
}
```

**查询写法：**

```javascript
// 学生选课
await prisma.enrollment.create({
  data: {
    student: { connect: { id: 1 } },
    course:  { connect: { id: 2 } },
  },
})

// 查询某学生的所有选课记录（含课程信息）
const enrollments = await prisma.enrollment.findMany({
  where: { studentId: 1 },
  include: { course: true },
})

// 查询某课程的所有学生（含分数）
const enrollments = await prisma.enrollment.findMany({
  where: { courseId: 2 },
  include: { student: true },
  orderBy: { score: 'desc' },
})
```

---

### 7.4 自关联（同一张表内的关系）
**场景：评论的回复（评论可以回复评论），组织架构（员工有上级），分类的子分类。**

```javascript
model Comment {
  id        Int       @id @default(autoincrement())
  content   String
  createdAt DateTime  @default(now())

  // 外键：父评论的 id（顶级评论该字段为 null）
  // Int? 末尾 ? 表示可选，顶级评论没有父评论
  parentId  Int?

  // 关联到同一张表的父评论
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id])

  // 反向关联：该评论下的所有子评论（回复）
  // 注意：双方都要有相同的关系名 "CommentReplies"
  replies   Comment[] @relation("CommentReplies")

  @@map("comments")
}
```

**查询写法：**

```javascript
// 查询顶级评论（parentId 为 null 的）以及其所有回复
const comments = await prisma.comment.findMany({
  where: { parentId: null },
  include: {
    replies: {
      include: { replies: true },   // 最多嵌套两层
    },
  },
})
```

---

## 八、主键和外键
### 8.1 主键（Primary Key）
主键用 `@id` 标记，每张表必须有且只有一个主键。

```javascript
model User {
  // 方式一：整数自增主键（最常见）
  // autoincrement() 从 1 开始，每次插入自动 +1
  id Int @id @default(autoincrement())

  // 方式二：UUID 字符串主键
  // 优点：不暴露数据量，适合分布式系统
  // 缺点：索引性能稍差，存储空间稍大
  id String @id @default(uuid())

  // 方式三：cuid 字符串主键
  // 比 UUID 短，包含时间戳，有一定排序性
  id String @id @default(cuid())
}

// 复合主键（多个字段联合作为主键）
// 适合中间表
model PostTag {
  postId Int
  tagId  Int

  // @@id 声明复合主键：postId + tagId 的组合唯一
  @@id([postId, tagId])
}
```

### 8.2 外键（Foreign Key）
外键是一个字段，它的值引用另一张表的主键，建立两张表之间的关联。

```javascript
model Post {
  id       Int  @id @default(autoincrement())
  title    String

  // authorId 就是外键字段
  // 这个字段的值必须在 User 表的 id 字段里存在
  // 如果插入一个不存在的 authorId，数据库会报外键约束错误
  authorId Int

  // @relation 声明外键约束
  author   User @relation(fields: [authorId], references: [id])
}
```

### 8.3 onDelete 选项详解
```javascript
model Post {
  author User @relation(
    fields: [authorId],
    references: [id],

    // onDelete 控制当关联的父记录被删除时，子记录怎么处理
    // 有四个选项：

    // Cascade  → 级联删除，删除用户时同时删除其所有文章（最常用）
    // Restrict → 限制删除，如果用户有文章则不允许删除用户（默认值）
    // SetNull  → 置空，删除用户时把文章的 authorId 设为 null（需要字段是可选的）
    // NoAction → 不做任何操作（依赖数据库的默认行为）
    onDelete: Cascade
  )
}
```

---

## 九、模型和数据库表的关系
模型（Model）和数据库表（Table）的对应关系：

```json
Prisma Schema                    PostgreSQL 数据库
─────────────────────────────────────────────────────
model User        ←→    users 表（由 @@map("users") 指定）
  id Int           ←→    id 列（INTEGER）
  email String     ←→    email 列（TEXT）
  name String      ←→    name 列（TEXT）
  posts Post[]     ←→    （不生成列！这是 Prisma 的关联声明）

model Post         ←→    posts 表
  id Int           ←→    id 列（INTEGER）
  authorId Int     ←→    "authorId" 列（INTEGER，外键）
  author User      ←→    （不生成列！这是 Prisma 的关联声明）
```

**规则总结：**

| Schema 里的写法 | 数据库里是否生成列 | 说明 |
| --- | --- | --- |
| `id Int @id` | ✅ 生成列 | 普通字段，生成对应数据库列 |
| `authorId Int` | ✅ 生成列 | 外键字段，生成对应数据库列 |
| `author User @relation(...)` | ❌ 不生成列 | 关联声明，只给 Prisma 用 |
| `posts Post[]` | ❌ 不生成列 | 关联声明，只给 Prisma 用 |


**表名的对应规则：**

```javascript
// 不写 @@map，表名默认是模型名（区分大小写）
model User {
  // 对应数据库表名：User（大写 U）
}

// 写了 @@map，使用指定的表名
model User {
  @@map("users")
  // 对应数据库表名：users（小写）
}
```

推荐：始终写 `@@map("表名")`，使用小写复数（users、posts、orders），符合数据库命名规范。

---

## 十、模型是否自动生成数据库表
**结论：不是自动的，需要手动执行命令。**

Prisma 不会在你写完 Schema 后立刻去数据库建表。需要通过以下两种方式之一来同步：

---

### 方式一：prisma migrate dev（推荐，用于开发环境）
```bash
npx prisma migrate dev --name 本次变更的描述
```

**执行过程：**

```markdown
1. 读取 prisma/schema.prisma 里的模型定义
        ↓
2. 和数据库当前结构对比，计算出"差异"
        ↓
3. 自动生成 SQL 语句（建表、加字段、加索引等）
        ↓
4. 在数据库里执行这些 SQL
        ↓
5. 把生成的 SQL 保存到 prisma/migrations/ 目录（作为历史记录）
        ↓
6. 重新执行 prisma generate，更新 Prisma Client 的类型
```

**生成的迁移文件示例（**`**prisma/migrations/20251130000000_init/migration.sql**`**）：**

```sql
-- Prisma 自动生成，不要手动修改

CREATE TABLE "users" (
    "id"        SERIAL PRIMARY KEY,
    "email"     TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "posts" (
    "id"        SERIAL PRIMARY KEY,
    "title"     TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId"  INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "posts"
    ADD CONSTRAINT "posts_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
```

---

### 方式二：prisma db push（用于快速原型）
```bash
npx prisma db push
```

和 `migrate dev` 的区别：

+ 直接把 Schema 推送到数据库，**不生成迁移文件**
+ 适合早期探索阶段，表结构还在频繁变动时
+ 缺点：没有变更历史记录，团队协作和生产环境不推荐

---

### 修改表结构的流程
每次修改了 `schema.prisma`（新增字段、改类型、加索引等），都要重新执行迁移：

```bash
# 例如：给 User 模型加了 phone 字段
npx prisma migrate dev --name add_phone_to_user
```

Prisma 只会生成**增量 SQL**（只改变化的部分），不会删除已有数据。

---

## 十一、完整实战 Schema 示例
下面是一个博客系统的完整 Schema，包含了所有常见关系类型：

```javascript
// prisma/schema.prisma

generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

// ── 用户表 ────────────────────────────────────────────────
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      String   @default("user")      // 角色：user | admin
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 一对一：一个用户对应一个详情
  profile   UserProfile?

  // 一对多：一个用户可以写多篇文章
  posts     Post[]

  // 一对多：一个用户可以发多条评论
  comments  Comment[]

  @@map("users")
}

// ── 用户详情表（一对一）────────────────────────────────────
model UserProfile {
  id        Int     @id @default(autoincrement())
  bio       String? @db.Text    // 个人简介，可选
  avatar    String?             // 头像 URL，可选
  phone     String?             // 手机号，可选
  website   String?             // 个人网站，可选

  // 外键，@unique 确保一对一
  userId    Int     @unique
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

// ── 文章分类表 ────────────────────────────────────────────
model Category {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  description String? @db.Text
  slug        String  @unique    // URL 友好名称，如 "frontend-dev"

  // 一对多：一个分类下有多篇文章
  posts       Post[]

  @@map("categories")
}

// ── 标签表 ────────────────────────────────────────────────
model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique

  // 多对多：一个标签可以属于多篇文章
  posts Post[]

  @@map("tags")
}

// ── 文章表 ────────────────────────────────────────────────
model Post {
  id          Int      @id @default(autoincrement())
  title       String
  content     String   @db.Text
  published   Boolean  @default(false)
  viewCount   Int      @default(0)
  coverImage  String?            // 封面图 URL，可选
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 外键：关联作者（多对一，多篇文章对应一个用户）
  authorId    Int
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // 外键：关联分类（多对一，可选）
  categoryId  Int?
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // 多对多：一篇文章可以有多个标签（隐式，Prisma 自动管理中间表）
  tags        Tag[]

  // 一对多：一篇文章可以有多条评论
  comments    Comment[]

  // 给 authorId 加索引（经常按作者查文章）
  @@index([authorId])
  // 给 categoryId 加索引
  @@index([categoryId])
  // 给 published + createdAt 加组合索引（首页常用的查询条件）
  @@index([published, createdAt])

  @@map("posts")
}

// ── 评论表（含自关联）────────────────────────────────────
model Comment {
  id        Int      @id @default(autoincrement())
  content   String   @db.Text
  createdAt DateTime @default(now())

  // 外键：关联作者
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // 外键：关联文章
  postId    Int
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  // 自关联：回复某条评论
  // Int? 表示可选，顶级评论没有 parentId
  parentId  Int?
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")

  @@index([postId])
  @@index([authorId])

  @@map("comments")
}
```

---

## 十二、Prisma Client 查询常用写法
### 12.1 基础 CRUD
```javascript
// 创建
const user = await prisma.user.create({
  data: { name: '大伟', email: 'dawei@example.com', password: '123456' },
})

// 查询所有
const users = await prisma.user.findMany()

// 按主键查单条
const user = await prisma.user.findUnique({ where: { id: 1 } })

// 按条件查第一条
const user = await prisma.user.findFirst({ where: { role: 'admin' } })

// 更新
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { name: '新名字' },
})

// 删除
await prisma.user.delete({ where: { id: 1 } })
```

### 12.2 条件过滤
```javascript
// 等于
prisma.post.findMany({ where: { published: true } })

// 包含（模糊匹配，类似 SQL LIKE '%xxx%'）
prisma.post.findMany({ where: { title: { contains: 'Vue3' } } })

// 开头匹配
prisma.post.findMany({ where: { title: { startsWith: 'NestJS' } } })

// 大于 / 小于
prisma.post.findMany({ where: { viewCount: { gt: 100 } } })
// gt > | gte >= | lt < | lte <=

// 多条件 AND（默认就是 AND）
prisma.post.findMany({
  where: {
    published: true,
    authorId: 1,
  },
})

// 多条件 OR
prisma.post.findMany({
  where: {
    OR: [
      { title: { contains: 'Vue' } },
      { title: { contains: 'React' } },
    ],
  },
})

// NOT
prisma.post.findMany({
  where: { NOT: { published: true } },
})
```

### 12.3 联表查询
```javascript
// include：获取关联数据（类似 SQL JOIN）
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    profile: true,      // 包含用户详情
    posts: true,        // 包含所有文章
  },
})

// include 嵌套（文章里还要获取评论）
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: {
      include: { comments: true },    // 文章里的评论
      where: { published: true },     // 只要已发布的文章
      orderBy: { createdAt: 'desc' }, // 按时间排序
    },
  },
})

// select：只返回指定字段（比 include 更精确）
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    name: true,
    email: true,
    // password 不返回（安全）
    posts: {
      select: { id: true, title: true },
    },
  },
})
```

### 12.4 排序和分页
```javascript
// 排序
prisma.post.findMany({
  orderBy: { createdAt: 'desc' },  // desc 降序 | asc 升序
})

// 多字段排序
prisma.post.findMany({
  orderBy: [
    { published: 'desc' },
    { createdAt: 'desc' },
  ],
})

// 分页（skip + take）
// 第 2 页，每页 10 条
const page = 2
const pageSize = 10
prisma.post.findMany({
  skip: (page - 1) * pageSize,   // 跳过前 10 条
  take: pageSize,                 // 取 10 条
  orderBy: { createdAt: 'desc' },
})

// 统计总数（用于前端显示总页数）
const total = await prisma.post.count({ where: { published: true } })
```

### 12.5 多对多操作
```javascript
// 给文章添加标签
await prisma.post.update({
  where: { id: 1 },
  data: {
    tags: {
      connect: [{ id: 1 }, { id: 2 }],     // 添加标签
      disconnect: [{ id: 3 }],              // 移除标签
      set: [{ id: 1 }, { id: 4 }],          // 替换为新标签（先清空再添加）
    },
  },
})
```

---

## 附：完整命令速查
| 命令 | 作用 |
| --- | --- |
| `npx prisma init --output ../src/generated/prisma` | 初始化 Prisma 7 |
| `npx prisma migrate dev --name 描述` | 修改 schema 后同步到数据库 |
| `npx prisma generate` | 重新生成 Prisma Client 类型 |
| `npx prisma migrate deploy` | 生产环境执行迁移 |
| `npx prisma db push` | 快速同步（不生成迁移文件） |
| `npx prisma studio` | 打开可视化数据库界面 |
| `npx prisma format` | 格式化 schema.prisma |
| `npx prisma validate` | 验证 schema 语法 |


---

## 附：Prisma 7 关键记忆点
```markdown
schema.prisma 里写模型
    ↓ 执行
npx prisma migrate dev
    ↓ 自动
生成 migration.sql（建表 SQL）+ 在数据库执行 + 生成 Client 代码
    ↓
在代码里通过 prisma.模型名.方法名() 查询数据库

关联关系三要素：
  1. 外键字段（authorId Int）         → 真实存在于数据库
  2. 关联声明（author User @relation）→ 给 Prisma 用，不生成列
  3. 反向声明（posts Post[]）         → 给 Prisma 用，不生成列
```
