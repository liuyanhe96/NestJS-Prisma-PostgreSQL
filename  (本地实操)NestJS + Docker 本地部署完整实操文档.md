

适合人群：想掌握部署流程但暂时不买云服务器的开发者 技术栈：NestJS · Prisma 7 · PostgreSQL 18 · Docker · Docker Compose · Nginx 目标：在本地完整模拟生产环境部署流程，掌握所有核心操作

---

## 目录
1. 本地部署和云服务器部署的区别
2. 安装 Docker Desktop
3. 准备项目代码和部署文件
4. 编写 Dockerfile
5. 编写 docker-compose.yml
6. 配置 Nginx 反向代理
7. 配置本地生产环境变量
8. 构建镜像并启动所有服务
9. 执行数据库迁移
10. 验证部署成功
11. 用 Apifox 测试所有接口
12. 日常运维操作练习
13. 模拟更新部署流程
14. Docker 核心概念理解
15. 常见报错处理

---

## 一、本地部署和云服务器部署的区别
| 对比项 | 本地部署 | 云服务器部署 |
| --- | --- | --- |
| 费用 | 免费 | 需要购买服务器 |
| 公网访问 | 只能本机访问 | 全球可访问 |
| 学习目的 | 掌握部署流程 | 真实上线 |
| 环境差异 | 几乎没有 | 几乎没有 |
| Docker 命令 | 完全一样 | 完全一样 |
| 部署文件 | 完全一样 | 完全一样 |


**核心结论：本地部署和云服务器部署的所有操作步骤、命令、配置文件完全一致。** 唯一的区别是访问地址：本地是 `http://localhost`，云服务器是 `http://公网IP`。

学会了本地部署，迁移到云服务器只需要：

1. 在云服务器上安装 Docker
2. 把代码上传到服务器
3. 重复执行相同的命令

---

## 二、安装 Docker Desktop
Docker Desktop 是 Docker 在 macOS 和 Windows 上的桌面客户端，包含了 Docker Engine 和 Docker Compose。

### macOS 安装
访问 https://www.docker.com/products/docker-desktop/ 下载对应芯片版本：

+ Apple Silicon（M1/M2/M3）选 Apple Silicon
+ Intel Mac 选 Intel Chip

下载 .dmg，双击安装，拖入 Applications 即可。

验证安装：

```bash
docker --version
# 输出：Docker version 27.x.x

docker compose version
# 输出：Docker Compose version v2.x.x

docker run hello-world
# 看到 "Hello from Docker!" 说明一切正常
```

---

### Windows 安装
1. 访问 https://www.docker.com/products/docker-desktop/
2. 点击 Download for Windows 下载 .exe
3. 双击安装，安装过程中勾选 Use WSL 2 instead of Hyper-V（推荐）
4. 安装完成后重启电脑
5. 启动 Docker Desktop，等待左下角变成绿色 Engine running

验证安装（PowerShell 里执行）：

```bash
docker --version
docker compose version
docker run hello-world
```

Windows 注意：如果提示需要安装 WSL 2，按照提示访问微软官网安装 WSL 2 即可。

---

### Linux（Ubuntu）安装
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

---

### Docker Desktop 界面说明
安装后打开 Docker Desktop，主要有四个标签页：

+ Containers：查看所有运行中的容器
+ Images：查看本地已下载的镜像
+ Volumes：查看数据卷
+ Networks：查看 Docker 网络

---

## 三、准备项目代码和部署文件
在 NestJS 项目根目录里，需要新增以下文件：

```plain
nestjs-prisma7-demo/           ← 你的 NestJS 项目根目录
├── Dockerfile                 ← 新增：Docker 镜像构建文件
├── docker-compose.yml         ← 新增：多服务编排文件
├── .dockerignore              ← 新增：Docker 构建时忽略的文件
├── nginx/
│   ├── nginx.conf             ← 新增：Nginx 配置
│   └── ssl/                  ← 新增：SSL 证书目录（本地暂时为空）
├── .env.docker                ← 新增：Docker 本地环境变量
├── prisma/
│   ├── schema.prisma          ← 已有
│   └── migrations/            ← 已有
├── src/                       ← 已有
├── package.json               ← 已有
└── tsconfig.json              ← 已有
```

创建 nginx 目录：

```bash
mkdir -p nginx/ssl
```

---

## 四、编写 Dockerfile
在项目根目录创建 `Dockerfile`：

```dockerfile
# Dockerfile
# 使用多阶段构建：减小最终镜像体积，提高安全性

# ══════════════════════════════════════════════════════
# 第一阶段：构建阶段
# 安装所有依赖、生成 Prisma Client、编译 TypeScript
# ══════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# 先单独复制 package.json，利用 Docker 缓存层
# 只要 package.json 没变，npm install 这层会走缓存，加快构建
COPY package*.json ./

# 安装全部依赖（包含 devDependencies，TypeScript 编译需要）
# 使用国内镜像源，速度更快
RUN npm install --registry=https://registry.npmmirror.com

# 复制 Prisma 相关文件（必须在 prisma generate 之前）
COPY prisma ./prisma
COPY prisma.config.ts ./

# 复制所有源代码
COPY . .

# 生成 Prisma Client
# 根据 schema.prisma 生成到 src/generated/prisma/
RUN npx prisma generate

# 编译 TypeScript 到 dist/
RUN npm run build

# ══════════════════════════════════════════════════════
# 第二阶段：生产阶段
# 只包含运行所需的文件，不包含构建工具
# 最终镜像体积从约 800MB 减小到约 200MB
# ══════════════════════════════════════════════════════
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# 从构建阶段复制 package.json
COPY --from=builder /app/package*.json ./

# 只安装生产依赖（不安装 TypeScript、ts-node 等开发工具）
RUN npm install --only=production --registry=https://registry.npmmirror.com

# 从构建阶段复制编译后的 JavaScript
COPY --from=builder /app/dist ./dist

# 从构建阶段复制 Prisma 生成的 Client
COPY --from=builder /app/src/generated ./src/generated

# 复制 prisma 目录（执行迁移时需要）
COPY --from=builder /app/prisma ./prisma

# 复制 prisma.config.ts（Prisma 7 必须的配置文件）
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 创建 .dockerignore
在项目根目录创建 `.dockerignore`：

```plain
# .dockerignore

node_modules
dist
src/generated

.env
.env.*
!.env.example

.git
.gitignore
.vscode
.idea

*.log
npm-debug.log*

test
**/*.spec.ts
**/*.test.ts

README.md
*.md
```

---

## 五、编写 docker-compose.yml
在项目根目录创建 `docker-compose.yml`：

```yaml
# docker-compose.yml
# 定义整个应用的所有服务

version: '3.8'

services:

  # ══════════════════════════════════════════════════
  # 服务一：PostgreSQL 18 数据库
  # ══════════════════════════════════════════════════
  postgres:
    image: postgres:18-alpine
    container_name: nestjs_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    # 暴露 5433 端口（避免和本机已安装的 PostgreSQL 5432 端口冲突）
    # 可以用 Navicat / DBeaver 连接 localhost:5433 直接查看数据
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    # 健康检查：确认 PostgreSQL 真正可以接受连接后，NestJS 才启动
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  # ══════════════════════════════════════════════════
  # 服务二：NestJS 应用
  # ══════════════════════════════════════════════════
  nestjs:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nestjs_app
    restart: unless-stopped
    env_file:
      - .env.docker
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network

  # ══════════════════════════════════════════════════
  # 服务三：Nginx 反向代理
  # ══════════════════════════════════════════════════
  nginx:
    image: nginx:alpine
    container_name: nestjs_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - nestjs
    networks:
      - app-network

# ══════════════════════════════════════════════════════
# 数据卷：持久化 PostgreSQL 数据
# 容器删除后数据不会丢失
# ══════════════════════════════════════════════════════
volumes:
  postgres_data:
    driver: local

# ══════════════════════════════════════════════════════
# 网络：容器间内部通信
# 同一网络里的容器可以用服务名互相访问
# NestJS 连 PostgreSQL 用 postgres:5432（不是 localhost:5432）
# ══════════════════════════════════════════════════════
networks:
  app-network:
    driver: bridge
```

---

## 六、配置 Nginx 反向代理
创建 `nginx/nginx.conf`：

```nginx
# nginx/nginx.conf

worker_processes auto;

events {
  worker_connections 1024;
}

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;

  log_format main '$remote_addr - [$time_local] "$request" $status "$http_user_agent"';
  access_log /var/log/nginx/access.log main;
  error_log  /var/log/nginx/error.log warn;

  sendfile on;
  client_max_body_size 10m;
  keepalive_timeout 65;

  gzip on;
  gzip_min_length 1024;
  gzip_types text/plain application/json application/javascript text/css;

  server {
    listen 80;
    # 本地部署填 localhost，云服务器部署填域名或 IP
    server_name localhost _;

    # 把所有请求转发给 NestJS 容器
    # nestjs 是 docker-compose.yml 里的服务名，Docker DNS 自动解析
    location / {
      proxy_pass http://nestjs:3000;
      proxy_set_header X-Real-IP        $remote_addr;
      proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
      proxy_set_header Host             $host;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_connect_timeout 60s;
      proxy_send_timeout    60s;
      proxy_read_timeout    60s;
    }

    # Nginx 自身健康检查接口
    location /nginx-health {
      return 200 'Nginx is running';
      add_header Content-Type text/plain;
    }
  }
}
```

---

## 七、配置本地生产环境变量
在项目根目录创建 `.env.docker`：

```plain
# .env.docker
# Docker 本地部署的环境变量配置

# PostgreSQL 配置
POSTGRES_USER=nestjs_user
POSTGRES_PASSWORD=nestjs_local_password_2025
POSTGRES_DB=nest_demo

# Prisma 数据库连接字符串
# 重要：主机名是 postgres（docker-compose 里的服务名）
# 不是 localhost！容器之间通过服务名通信
DATABASE_URL="postgresql://nestjs_user:nestjs_local_password_2025@postgres:5432/nest_demo?schema=public"

# NestJS 配置
NODE_ENV=production
PORT=3000
```

把 `.env.docker` 加入 `.gitignore`：

```bash
echo ".env.docker" >> .gitignore
```

理解 `@postgres:5432` 而不是 `@localhost:5432` 的原因：

+ 本地开发（不用 Docker）：NestJS 直接在本机运行，PostgreSQL 也在本机，用 localhost
+ Docker 部署：NestJS 在自己的容器里，PostgreSQL 在另一个容器里，两个容器通过 Docker 内部网络通信，主机名是服务名 postgres，不是 localhost

---

## 八、构建镜像并启动所有服务
### 检查文件结构
```bash
# 项目根目录执行，确认所有文件存在
ls -la
# 应该看到：Dockerfile docker-compose.yml .env.docker nginx/ .dockerignore

ls nginx/
# 应该看到：nginx.conf ssl/
```

### 构建并启动
```bash
# 在项目根目录执行
# --build：强制重新构建镜像（第一次必须加）
# -d：后台运行，不占用终端
docker compose up --build -d
```

首次执行输出示例（约 3~10 分钟）：

```plain
[+] Building 45.3s (18/18) FINISHED
 => [builder 1/8] FROM docker.io/library/node:20-alpine
 => [builder 3/8] COPY package*.json ./
 => [builder 4/8] RUN npm install
 => [builder 7/8] RUN npx prisma generate
 => [builder 8/8] RUN npm run build
 => [runner  ...] COPY --from=builder ...

[+] Running 3/3
 ✔ Container nestjs_postgres  Healthy
 ✔ Container nestjs_app       Started
 ✔ Container nestjs_nginx     Started
```

### 查看启动状态
```bash
docker compose ps
```

正常状态：

```plain
NAME               IMAGE              STATUS
nestjs_postgres    postgres:18-alpine Up (healthy)
nestjs_app         nestjs-app         Up
nestjs_nginx       nginx:alpine       Up
```

三个容器都是 Up，postgres 显示 (healthy) 才算正常。

### 查看实时日志
```bash
# 查看 NestJS 日志（最常用）
docker compose logs -f nestjs

# 正常应该看到：
# nestjs_app | ✅ PostgreSQL 18 数据库连接成功（Prisma 7）
# nestjs_app | [NestApplication] Nest application successfully started
# nestjs_app | Application is listening on port 3000

# 查看所有服务日志
docker compose logs -f

# 查看最近 50 行
docker compose logs --tail=50 nestjs
```

---

## 九、执行数据库迁移
```bash
# 在运行中的 nestjs 容器里执行 prisma migrate deploy
docker compose exec nestjs npx prisma migrate deploy
```

成功输出：

```plain
Applying migration `20251130000000_init`

The following migration(s) have been applied:
migrations/
  └─ 20251130000000_init/
       └─ migration.sql

All migrations have been successfully applied.
```

### 验证数据库建表成功
```bash
# 进入 PostgreSQL 容器的命令行
docker compose exec postgres psql -U nestjs_user -d nest_demo

# 执行以下 SQL 命令
\dt                  # 查看所有表（应该看到 users 和 posts）
\d users             # 查看 users 表结构
SELECT * FROM users; # 查询用户数据（目前为空）
\q                   # 退出
```

---

## 十、验证部署成功
### 方式一：浏览器访问
```plain
通过 Nginx（80 端口）：
http://localhost/user/list

通过 NestJS 直接访问（3000 端口）：
http://localhost:3000/user/list
```

看到以下 JSON 说明部署成功：

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  },
  "list": []
}
```

### 方式二：curl 命令测试
```bash
# 测试用户列表
curl http://localhost/user/list

# 测试创建用户
curl -X POST http://localhost/user/create \
  -H "Content-Type: application/json" \
  -d '{"name":"大伟老师","email":"dawei@example.com","password":"123456","role":"admin"}'

# 测试文章列表
curl http://localhost/post/list
```

### 方式三：Docker Desktop 界面
打开 Docker Desktop → Containers，看到三个容器都显示绿色运行中状态即可。点击 nestjs_app 可以查看实时日志。

---

## 十一、用 Apifox 测试所有接口
把 Apifox 里的 Base URL 从 `http://localhost:3000` 改成 `http://localhost`（通过 Nginx 的 80 端口，模拟生产环境）。

### 用户接口测试
```plain
创建用户：POST http://localhost/user/create
分页查询：GET  http://localhost/user/list?page=1&pageSize=10
模糊搜索：GET  http://localhost/user/list?name=大伟
按角色过滤：GET http://localhost/user/list?role=admin
查单个用户：GET http://localhost/user/1
更新用户：PUT  http://localhost/user/1
删除用户：DELETE http://localhost/user/1
```

### 文章接口测试
```plain
创建文章：POST   http://localhost/post/create
查文章列表：GET  http://localhost/post/list
查已发布：GET   http://localhost/post/list?published=true
查单篇文章：GET  http://localhost/post/1
更新文章：PUT    http://localhost/post/1
切换发布状态：PATCH http://localhost/post/1/publish
删除文章：DELETE http://localhost/post/1
```

---

## 十二、日常运维操作练习
以下命令和云服务器操作完全一样，本地练熟了上云完全无缝衔接。

### 查看容器资源占用
```bash
# 实时查看每个容器的 CPU 和内存使用（Ctrl+C 退出）
docker stats

# 输出示例：
# CONTAINER        CPU %  MEM USAGE
# nestjs_app       0.5%   85MB
# nestjs_postgres  0.3%   42MB
# nestjs_nginx     0.0%   5MB
```

### 进入容器内部调试
```bash
# 进入 NestJS 容器（Alpine 镜像用 sh，不是 bash）
docker compose exec nestjs sh
ls dist/       # 查看编译后的文件
exit           # 退出

# 进入 PostgreSQL 容器，执行 SQL
docker compose exec postgres psql -U nestjs_user -d nest_demo
SELECT COUNT(*) FROM users;
SELECT * FROM posts LIMIT 5;
\q
```

### 查看 Docker 资源
```bash
# 查看所有镜像
docker images

# 查看所有数据卷
docker volume ls

# 查看 Docker 整体磁盘占用
docker system df
```

### 停止和重启
```bash
# 停止所有服务（容器停止但不删除，数据保留）
docker compose stop

# 重新启动
docker compose start

# 停止并删除容器（数据卷保留，数据不丢失）
docker compose down

# 重新启动
docker compose up -d

# 只重启 NestJS
docker compose restart nestjs

# 只重启 Nginx（改了 nginx.conf 后执行）
docker compose restart nginx
```

### 备份数据库
```bash
# 把 PostgreSQL 数据导出到 SQL 文件
docker compose exec postgres pg_dump \
  -U nestjs_user nest_demo > backup_$(date +%Y%m%d_%H%M%S).sql

# 查看备份文件
ls -lh backup_*.sql

# 恢复备份（谨慎操作）
cat backup_20251130_120000.sql | \
  docker compose exec -T postgres psql -U nestjs_user -d nest_demo
```

### 清理 Docker 资源
```bash
# 删除所有停止的容器
docker container prune -f

# 删除所有未使用的镜像
docker image prune -f

# 一键清理无用资源
docker system prune -f
```

---

## 十三、模拟更新部署流程
### 场景一：修改了 NestJS 业务代码
```bash
# 第一步：修改代码（比如在某个 Service 里加了新方法）

# 第二步：重新构建并部署
# --build 强制重新构建，-d 后台运行
docker compose up --build -d

# Docker 会智能使用缓存：
# package.json 没变 → npm install 走缓存（很快）
# 只有代码变化的层会重新执行
# 总体比第一次快很多

# 第三步：确认新版本正常运行
docker compose logs --tail=20 nestjs
curl http://localhost/user/list
```

---

### 场景二：给数据库新增字段
```bash
# 第一步：修改 prisma/schema.prisma
# 例如给 User 模型加 phone 字段

# 第二步：在本地（非 Docker）生成迁移文件
# 注意：要用本地的 .env 文件，不是 .env.docker
# 确保本地安装了 PostgreSQL 或者本地 .env 连接字符串正确
npx prisma migrate dev --name add_phone_to_user

# 这会在 prisma/migrations/ 目录生成新的迁移 SQL 文件

# 第三步：重新构建（schema 变了，Prisma Client 要重新生成）
docker compose up --build -d

# 第四步：在 Docker 容器里执行迁移（应用新的 SQL）
docker compose exec nestjs npx prisma migrate deploy

# 第五步：验证字段已添加
docker compose exec postgres psql -U nestjs_user -d nest_demo -c "\d users"
# 应该看到 phone 列
```

---

## 十四、Docker 核心概念理解
### 镜像（Image）vs 容器（Container）
```plain
镜像（Image）= 安装包
  静态的、只读的文件
  可以用一个镜像启动多个容器
  例如：node:20-alpine、postgres:18-alpine

容器（Container）= 运行中的进程
  镜像运行起来的实例
  有自己独立的文件系统和网络
  例如：nestjs_app、nestjs_postgres
```

### 为什么用 Docker Compose
```plain
不用 Compose，启动三个服务需要：
  docker run -d postgres ...（一堆参数）
  docker run -d nestjs_app ...（一堆参数）
  docker run -d nginx ...（一堆参数）
  手动创建网络，手动连接...

用了 Compose：
  docker compose up -d
  一条命令，自动按顺序启动，自动配置网络
```

### 数据卷（Volume）为什么重要
```plain
没有 Volume：
  PostgreSQL 数据存在容器内
  docker compose down 删除容器 → 数据全丢！

有了 Volume：
  数据存在 Docker 管理的宿主机目录
  容器删了，数据还在
  下次 docker compose up，挂载同一个 Volume → 数据恢复
```

### 容器网络和服务名
```plain
同一个 docker-compose.yml 的服务会加入同一个网络
容器之间可以用服务名互相访问：

  NestJS 连 PostgreSQL：postgres:5432
  Nginx 转发到 NestJS：http://nestjs:3000

Docker 内部 DNS 自动把服务名解析成对应容器的 IP
这就是为什么 DATABASE_URL 里要写 postgres 而不是 localhost
```

### 两阶段构建（Multi-stage Build）
```plain
第一阶段（builder）：
  安装全部依赖（包含 TypeScript、ts-node 等开发工具）
  生成 Prisma Client
  编译 TypeScript → JavaScript
  
  这个阶段结束后，编译工具就没用了

第二阶段（runner）：
  只复制 dist/（编译后的 JS）
  只复制 src/generated/（Prisma Client）
  只安装生产依赖（npm install --only=production）
  
  不包含 TypeScript、ts-node 等开发工具

结果：
  不用两阶段：镜像约 800MB
  用两阶段：  镜像约 200MB
```

---

## 十五、常见报错处理
### 报错 1：80 端口被占用
```plain
Error: bind: address already in use (0.0.0.0:80)
```

解决：

```bash
# macOS/Linux 查看占用端口的进程
lsof -i :80

# Windows（PowerShell）
netstat -ano | findstr :80

# 方案一：停止占用 80 端口的程序
brew services stop nginx    # 如果是本地 Nginx

# 方案二：修改 docker-compose.yml，把 nginx 端口改成 8080
# ports:
#   - "8080:80"
# 然后访问 http://localhost:8080
```

---

### 报错 2：NestJS 容器启动后立刻退出
```bash
# 查看退出原因
docker compose logs nestjs
```

常见原因：

```plain
原因：DATABASE_URL 主机名写的是 localhost
解决：改成 postgres（Docker 服务名）
  错误：postgresql://user:pass@localhost:5432/db
  正确：postgresql://user:pass@postgres:5432/db

原因：.env.docker 文件不存在
解决：确认项目根目录有 .env.docker 文件，且 docker-compose.yml 里 env_file 路径正确

原因：prisma.config.ts 里没有 import 'dotenv/config'
解决：确认第一行是 import 'dotenv/config'
```

---

### 报错 3：PostgreSQL 健康检查一直等待
```plain
nestjs_app | waiting for postgres to be healthy...
```

通常等 30~60 秒即可（PostgreSQL 初始化需要时间）。

如果等很久还没好：

```bash
# 查看 PostgreSQL 日志
docker compose logs postgres

# 常见原因：密码里含特殊字符导致连接字符串解析错误
# 解决：先用简单密码测试（只用字母数字）
```

---

### 报错 4：Prisma 迁移失败
```plain
Error: The datasource url must start with postgresql://
```

原因：Docker 容器里读不到 DATABASE_URL 环境变量。

解决：

```bash
# 检查容器里的环境变量是否正确加载
docker compose exec nestjs env | grep DATABASE_URL

# 如果没有输出，检查 docker-compose.yml 的 env_file 路径
# 确认 .env.docker 文件存在且路径正确
```

---

### 报错 5：Docker 镜像拉取失败（网络问题）
```plain
Error: Get "https://registry-1.docker.io/v2/": timeout
```

解决：配置国内镜像加速器。

macOS / Windows（Docker Desktop）：

打开 Docker Desktop → Settings → Docker Engine，添加：

```json
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
```

点击 Apply & restart。

---

### 报错 6：npm install 很慢
在 Dockerfile 的 RUN npm install 命令里加 --registry 参数：

```dockerfile
RUN npm install --registry=https://registry.npmmirror.com
```

修改后重新构建：

```bash
docker compose up --build -d
```

---

## 附：本地部署 vs 云服务器部署对照
| 操作 | 本地 | 云服务器 |
| --- | --- | --- |
| 安装 Docker | Docker Desktop | curl -fsSL https://get.docker.com |
| 获取代码 | 直接在本地项目 | git clone 或 scp 上传 |
| 环境变量文件 | .env.docker | .env.production |
| 启动服务 | docker compose up --build -d | 完全相同 |
| 执行迁移 | docker compose exec nestjs npx prisma migrate deploy | 完全相同 |
| 查看日志 | docker compose logs -f nestjs | 完全相同 |
| 访问地址 | http://localhost | http://公网IP |


---

## 附：完整操作流程总结
第一次本地 Docker 部署：

```plain
1. 安装 Docker Desktop
        ↓
2. 项目根目录创建：
   Dockerfile
   docker-compose.yml
   .dockerignore
   nginx/nginx.conf
   .env.docker
        ↓
3. docker compose up --build -d
   （等待 3~10 分钟构建和启动）
        ↓
4. docker compose exec nestjs npx prisma migrate deploy
   （在数据库里建表）
        ↓
5. 浏览器访问 http://localhost/user/list 验证
        ↓
6. Apifox 把 Base URL 改成 http://localhost 测试所有接口
```

日常更新流程：

```plain
1. 修改代码
        ↓
2. docker compose up --build -d
        ↓
3. 如有 schema 变更：
   docker compose exec nestjs npx prisma migrate deploy
        ↓
4. 验证接口正常
```
