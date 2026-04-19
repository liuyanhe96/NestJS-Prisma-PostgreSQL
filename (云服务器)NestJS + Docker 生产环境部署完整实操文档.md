技术栈：NestJS · Prisma 7 · PostgreSQL 18 · Docker · Docker Compose · Nginx 服务器：阿里云 / 腾讯云 Linux（Ubuntu 22.04） 目标：把本地开发好的项目完整部署到公网可访问的服务器

---

## 目录
1. 部署整体架构
2. 购买服务器
3. 服务器初始化配置
4. 安装 Docker 和 Docker Compose
5. 准备项目代码
6. 编写 Dockerfile
7. 编写 docker-compose.yml
8. 配置 Nginx 反向代理
9. 配置生产环境变量
10. 上传代码到服务器
11. 启动所有服务
12. 执行数据库迁移
13. 验证部署成功
14. 日常运维命令
15. 常见问题处理

---

## 一、部署整体架构
```plain
公网用户
    ↓ HTTP/HTTPS 请求（80/443 端口）
┌─────────────────────────────────┐
│         Nginx 容器               │
│   反向代理 + 静态文件 + SSL        │
└────────────┬────────────────────┘
             │ 转发到内部端口 3000
┌────────────▼────────────────────┐
│         NestJS 容器              │
│       运行编译后的 dist/          │
└────────────┬────────────────────┘
             │ 内部网络连接
┌────────────▼────────────────────┐
│       PostgreSQL 18 容器         │
│         数据持久化存储             │
└─────────────────────────────────┘
             ↕ 挂载
┌─────────────────────────────────┐
│      Docker Volume（数据卷）      │
│   数据存在宿主机磁盘，容器重启不丢   │
└─────────────────────────────────┘
```

**为什么用 Docker？**

+ 环境一致：本地和服务器运行环境完全相同，不会出现"本地好用服务器报错"
+ 隔离性：每个服务在自己的容器里，互不干扰
+ 方便迁移：换服务器只需把代码和 docker-compose.yml 复制过去，一条命令启动
+ 版本控制：通过镜像版本管理每次部署

---

## 二、购买服务器
### 推荐配置(个人玩法)
| 配置项 | 推荐 | 说明 |
| --- | --- | --- |
| CPU | 2 核 | 1 核也能跑，但会卡 |
| 内存 | 2GB | Docker + PostgreSQL + NestJS 最低要求 |
| 硬盘 | 40GB SSD | 系统 + Docker 镜像 + 数据库 |
| 带宽 | 3Mbps 以上 | 够用 |
| 操作系统 | Ubuntu 22.04 LTS | 本文档基于此系统 |
| 地区 | 按需选择 | 国内用户选国内节点，速度快 |


---

### 阿里云购买步骤
1. 访问 https://www.aliyun.com，注册并实名认证
2. 顶部菜单 → **产品** → **云服务器 ECS**
3. 点击**立即购买**，选择配置：
    - 付费方式：**按量付费**（按小时计费，测试完随时释放，省钱）或**包年包月**（长期用）
    - 地域：选**华东（上海）** 或离你近的节点
    - 实例规格：**2核2GB**（ecs.t6-c1m2.large，约 0.15 元/小时）
    - 镜像：**Ubuntu 22.04 LTS 64位**
    - 系统盘：**40GB SSD**
    - 网络：**按使用流量计费**，带宽上限 5Mbps
4. 设置登录方式：
    - 选**密钥对**（更安全，推荐）或**自定义密码**
    - 如果选密码，设置一个强密码并记下来
5. 安全组配置（**关键步骤**）：
    - 购买后进入 ECS 控制台 → 该实例 → **安全组** → **配置规则**
    - 添加入方向规则：

| 协议 | 端口范围 | 授权对象 | 说明 |
| --- | --- | --- | --- |
| TCP | 22 | 0.0.0.0/0 | SSH 登录 |
| TCP | 80 | 0.0.0.0/0 | HTTP 访问 |
| TCP | 443 | 0.0.0.0/0 | HTTPS 访问 |
| TCP | 3000 | 0.0.0.0/0 | NestJS 直接访问（测试用） |


6. 购买完成后，在控制台找到服务器的**公网 IP**，记下来。

---

### 腾讯云购买步骤
1. 访问 https://cloud.tencent.com，注册并实名认证
2. 顶部 → **产品** → **云服务器 CVM**
3. 点击**快速配置**：
    - 地域：选**广州**或**上海**
    - 机型：**标准型 SA5**，2核2GB（约 0.12 元/小时）
    - 镜像：**Ubuntu Server 22.04 LTS 64位**
    - 系统盘：**50GB SSD**
    - 公网带宽：**按使用流量**，5Mbps
4. 设置密码（记下来）
5. 购买后在控制台找到**公网 IP**

---

## 三、服务器初始化配置
### 连接服务器
**macOS / Linux：**

```bash
# 替换 your-server-ip 为你的服务器公网 IP
ssh root@your-server-ip

# 如果用密钥对登录（阿里云下载的 .pem 文件）
chmod 400 your-key.pem
ssh -i your-key.pem root@your-server-ip
```

**Windows：** 推荐使用 **MobaXterm**（免费）或 **Tabby**：

+ 下载 MobaXterm：https://mobaxterm.mobatek.net/download.html
+ 新建 SSH 会话，填入公网 IP 和 root 密码，连接

---

### 系统初始化
连接成功后，依次执行：

```bash
# 更新系统软件包索引
apt update

# 升级已安装的软件包
apt upgrade -y

# 安装常用工具
apt install -y curl wget git vim ufw

# 设置时区为上海（北京时间）
timedatectl set-timezone Asia/Shanghai

# 验证时区
date
# 输出：Mon Sep 30 10:00:00 CST 2025
```

### 配置防火墙
```bash
# 开启防火墙
ufw enable

# 允许 SSH（必须先允许，否则下一步会断开连接）
ufw allow 22

# 允许 HTTP 和 HTTPS
ufw allow 80
ufw allow 443

# 允许 NestJS 端口（测试阶段用，上线后可关闭）
ufw allow 3000

# 查看防火墙状态
ufw status
```

### 创建普通用户（可选，更安全）
```bash
# 创建用户 deploy，以后用这个用户操作，不用 root
adduser deploy

# 给 deploy 用户添加 sudo 权限
usermod -aG sudo deploy

# 切换到 deploy 用户
su - deploy
```

---

## 四、安装 Docker 和 Docker Compose
```bash
# 切换回 root 用户执行（或用 sudo）
# 一键安装 Docker（官方脚本）
curl -fsSL https://get.docker.com | sh

# 把当前用户加入 docker 组（这样不需要每次都加 sudo）
usermod -aG docker $USER

# 重新加载用户组（让上面的设置生效）
newgrp docker

# 验证 Docker 安装成功
docker --version
# 输出：Docker version 27.x.x

# 验证 Docker Compose（Docker 27 以上已内置 docker compose 命令）
docker compose version
# 输出：Docker Compose version v2.x.x

# 设置 Docker 开机自启
systemctl enable docker
systemctl start docker
```

**注意**：如果服务器在国内，Docker Hub 拉取镜像可能很慢甚至失败。 配置国内镜像加速器：

```bash
# 创建 Docker 配置目录
mkdir -p /etc/docker

# 写入镜像加速配置
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
EOF

# 重启 Docker 使配置生效
systemctl daemon-reload
systemctl restart docker
```

---

## 五、准备项目代码
在**本地项目**根目录，确认以下文件结构存在：

```plain
nestjs-prisma7-demo/
├── src/
│   ├── generated/prisma/     ← 不要提交到 Git，.gitignore 里排除
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── user/
│   ├── post/
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/           ← 必须提交到 Git！迁移文件要上传
├── prisma.config.ts
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### 检查 .gitignore
确认本地 `.gitignore` 包含以下内容：

```plain
# .gitignore

# 依赖包（服务器会重新安装）
node_modules/

# 编译产物（服务器会重新编译）
dist/

# 环境变量（敏感信息，绝对不能提交）
.env
.env.production

# Prisma 生成的 Client（服务器会重新生成）
src/generated/

# 日志文件
*.log
npm-debug.log*
```

### 初始化 Git 并推送到代码仓库
```bash
# 本地项目根目录执行
git init
git add .
git commit -m "初始化项目"

# 推送到 GitHub / Gitee（选一个）
# GitHub：
git remote add origin https://github.com/你的用户名/nestjs-prisma7-demo.git
git push -u origin main

# Gitee（国内速度更快，推荐）：
git remote add origin https://gitee.com/你的用户名/nestjs-prisma7-demo.git
git push -u origin main
```

---

## 六、编写 Dockerfile
在项目根目录创建 `Dockerfile`：

```dockerfile
# Dockerfile

# ── 第一阶段：构建阶段（builder）────────────────────────────
# 使用 Node.js 20 Alpine 版本作为基础镜像
# Alpine 是精简版 Linux，镜像体积更小（约 50MB vs Ubuntu 的 200MB+）
FROM node:20-alpine AS builder

# 设置工作目录（容器内的工作路径）
WORKDIR /app

# 先单独复制 package.json 和 package-lock.json
# 好处：如果只改了业务代码，npm install 这层缓存不会失效，加快构建速度
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，因为构建需要 TypeScript 编译器）
RUN npm install

# 复制 prisma 目录（包含 schema.prisma 和 migrations）
COPY prisma ./prisma

# 复制 prisma.config.ts
COPY prisma.config.ts ./

# 复制其余所有源代码
COPY . .

# 生成 Prisma Client（根据 schema.prisma 生成 TypeScript 类型和查询代码）
# 生成位置：src/generated/prisma/
RUN npx prisma generate

# 编译 TypeScript → JavaScript
# 编译产物输出到 dist/ 目录
RUN npm run build

# ── 第二阶段：生产阶段（runner）─────────────────────────────
# 重新从干净的 Node.js 镜像开始，不包含构建工具
# 这样最终镜像只有运行所需的文件，体积更小、更安全
FROM node:20-alpine AS runner

# 设置 Node.js 运行环境为生产模式
# 生产模式下 NestJS 会关闭调试输出，性能更好
ENV NODE_ENV=production

WORKDIR /app

# 从 builder 阶段复制 package.json（安装生产依赖需要）
COPY --from=builder /app/package*.json ./

# 只安装生产依赖（不安装 devDependencies，减小镜像体积）
RUN npm install --only=production

# 从 builder 阶段复制编译好的 JavaScript 代码
COPY --from=builder /app/dist ./dist

# 从 builder 阶段复制 Prisma 生成的 Client 代码
COPY --from=builder /app/src/generated ./src/generated

# 从 builder 阶段复制 prisma 目录（迁移时需要）
COPY --from=builder /app/prisma ./prisma

# 从 builder 阶段复制 prisma.config.ts（Prisma 7 配置文件）
COPY --from=builder /app/prisma.config.ts ./

# 暴露 NestJS 服务端口
# EXPOSE 只是声明，实际端口映射在 docker-compose.yml 里配置
EXPOSE 3000

# 启动命令：运行编译后的入口文件
# 注意：生产环境运行 dist/main.js，不是 ts-node src/main.ts
CMD ["node", "dist/main.js"]
```

---

## 七、编写 docker-compose.yml
在项目根目录创建 `docker-compose.yml`：

```yaml
# docker-compose.yml
# 定义整个应用的所有服务（NestJS + PostgreSQL + Nginx）

version: '3.8'

services:

  # ── PostgreSQL 18 数据库服务 ──────────────────────────────
  postgres:
    # 使用 PostgreSQL 18 官方镜像
    image: postgres:18-alpine
    # 容器名称（方便查看日志和进入容器）
    container_name: nestjs_postgres
    # 容器崩溃或服务器重启后自动重启（always = 始终重启）
    restart: always
    # 环境变量（从 .env.production 文件读取）
    environment:
      # 数据库超级用户名
      POSTGRES_USER: ${POSTGRES_USER}
      # 数据库超级用户密码
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      # 自动创建的默认数据库名
      POSTGRES_DB: ${POSTGRES_DB}
    # 数据卷挂载：把数据库文件持久化到宿主机
    # 格式：宿主机路径或卷名:容器内路径
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # 网络：加入 app-network 内部网络
    # PostgreSQL 不对外暴露端口，只在内网和 NestJS 通信（更安全）
    networks:
      - app-network
    # 健康检查：确认 PostgreSQL 真正可以接受连接后，NestJS 才启动
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s      # 每 10 秒检查一次
      timeout: 5s        # 超时时间
      retries: 5         # 失败后重试 5 次

  # ── NestJS 应用服务 ──────────────────────────────────────
  nestjs:
    # build 表示用本地 Dockerfile 构建镜像，不是从镜像仓库拉取
    build:
      context: .         # Dockerfile 所在目录（当前目录）
      dockerfile: Dockerfile
    container_name: nestjs_app
    restart: always
    # 从 .env.production 文件读取环境变量
    env_file:
      - .env.production
    # 端口映射：宿主机端口:容器端口
    # 宿主机 3000 → 容器 3000（可以直接用 IP:3000 访问，测试用）
    ports:
      - "3000:3000"
    # 依赖关系：等 postgres 服务健康检查通过后才启动 nestjs
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network

  # ── Nginx 反向代理服务 ────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: nestjs_nginx
    restart: always
    ports:
      # 对外暴露 80 端口（HTTP）
      - "80:80"
      # 对外暴露 443 端口（HTTPS，后续配置 SSL 证书用）
      - "443:443"
    volumes:
      # 挂载 Nginx 配置文件
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # 挂载 SSL 证书目录（后续放证书用，现在先建好目录）
      - ./nginx/ssl:/etc/nginx/ssl:ro
    # Nginx 等 nestjs 启动后再启动
    depends_on:
      - nestjs
    networks:
      - app-network

# ── 数据卷定义 ────────────────────────────────────────────
volumes:
  # postgres_data：PostgreSQL 数据持久化卷
  # Docker 自动管理存储位置（通常在 /var/lib/docker/volumes/）
  postgres_data:
    driver: local

# ── 网络定义 ──────────────────────────────────────────────
networks:
  # app-network：容器间内部通信网络
  # 三个服务都在这个网络里，可以用服务名互相访问
  # 例如：NestJS 连接 PostgreSQL 用 postgres:5432（不是 localhost:5432）
  app-network:
    driver: bridge
```

---

## 八、配置 Nginx 反向代理
在项目根目录创建 `nginx/` 目录和配置文件：

```bash
# 本地执行
mkdir -p nginx/ssl
```

创建 `nginx/nginx.conf`：

```nginx
# nginx/nginx.conf

# worker_processes auto 表示根据 CPU 核心数自动设置工作进程数
worker_processes auto;

events {
  # 每个工作进程最大并发连接数
  worker_connections 1024;
}

http {
  # 引入 MIME 类型映射文件
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;

  # 日志格式定义
  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent"';

  # 访问日志路径
  access_log /var/log/nginx/access.log main;

  # 错误日志路径
  error_log /var/log/nginx/error.log warn;

  # 开启高效文件传输模式
  sendfile on;

  # 请求体最大大小（上传文件时用）
  client_max_body_size 10m;

  # 连接超时时间
  keepalive_timeout 65;

  # 开启 Gzip 压缩（减小传输数据量，加快响应速度）
  gzip on;
  gzip_types text/plain application/json application/javascript text/css;

  # ── HTTP 服务器配置 ──────────────────────────────────────
  server {
    # 监听 80 端口（HTTP）
    listen 80;

    # 服务器域名（替换成你自己的域名，没有域名先填 _ 匹配所有）
    # server_name api.yourdomain.com;
    server_name _;

    # ── API 接口转发 ──────────────────────────────────────
    location / {
      # 把所有请求转发给 NestJS 服务
      # nestjs 是 docker-compose.yml 里定义的服务名，Docker 内网可以直接用
      # 3000 是 NestJS 容器内部端口
      proxy_pass http://nestjs:3000;

      # 传递真实客户端 IP 给 NestJS（方便日志记录和限流）
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

      # 传递原始 Host 头（某些框架需要）
      proxy_set_header Host $host;

      # 传递协议信息（HTTP 还是 HTTPS）
      proxy_set_header X-Forwarded-Proto $scheme;

      # 代理超时时间（NestJS 处理慢请求时不要过早断开）
      proxy_connect_timeout 60s;
      proxy_send_timeout 60s;
      proxy_read_timeout 60s;
    }

    # ── 健康检查接口 ─────────────────────────────────────
    location /health {
      # 返回 200 OK，用于负载均衡器检查服务是否正常
      return 200 'OK';
      add_header Content-Type text/plain;
    }
  }
}
```

---

## 九、配置生产环境变量
在项目根目录创建 `.env.production` 文件（**只在服务器上创建，不要提交到 Git！**）

```json
# .env.production
# 生产环境配置文件
# 注意：这个文件绝对不能提交到 Git，必须在 .gitignore 里排除

# ── PostgreSQL 数据库配置 ──────────────────────────────────
# 数据库用户名（自定义，不要用 root 或 postgres 等默认名）
POSTGRES_USER=nestjs_user

# 数据库密码（必须是强密码：大小写字母 + 数字 + 特殊字符，至少 16 位）
POSTGRES_PASSWORD=Nestjs@2025#SecurePass

# 数据库名称
POSTGRES_DB=nest_demo

# ── Prisma 数据库连接字符串 ────────────────────────────────
# 注意：主机名是 postgres（docker-compose 里的服务名），不是 localhost
# 在 Docker 容器网络里，服务之间用服务名通信
DATABASE_URL="postgresql://nestjs_user:Nestjs@2025#SecurePass@postgres:5432/nest_demo?schema=public"

# ── NestJS 应用配置 ────────────────────────────────────────
# 运行环境
NODE_ENV=production

# 服务监听端口（容器内部端口）
PORT=3000
```

**重要**：`.env.production` 只在服务器上手动创建，本地不要创建这个文件，代码仓库里也绝对不能有这个文件。

---

## 十、上传代码到服务器
### 方式一：从 Git 仓库拉取（推荐）
```bash
# 在服务器上执行
# 进入部署目录
cd /var/www

# 从 Git 克隆项目（替换为你的仓库地址）
# GitHub：
git clone https://github.com/你的用户名/nestjs-prisma7-demo.git

# Gitee：
git clone https://gitee.com/你的用户名/nestjs-prisma7-demo.git

# 进入项目目录
cd nestjs-prisma7-demo

# 查看文件是否完整
ls -la
```

---

### 方式二：用 scp 直接上传（没有 Git 时）
```bash
# 在本地执行，把整个项目目录上传到服务器
# 排除 node_modules 和 dist（服务器会重新生成）
scp -r --exclude=node_modules --exclude=dist --exclude=.env \
  ./nestjs-prisma7-demo \
  root@your-server-ip:/var/www/

# 如果用密钥登录
scp -i your-key.pem -r ./nestjs-prisma7-demo \
  root@your-server-ip:/var/www/
```

---

### 创建生产环境变量文件
代码上传后，在服务器上手动创建 `.env.production`：

```bash
# 进入项目目录
cd /var/www/nestjs-prisma7-demo

# 创建并编辑生产环境变量文件
# vim 编辑器：按 i 进入编辑模式，粘贴内容，按 Esc，输入 :wq 保存退出
vim .env.production
```

把第九节的 `.env.production` 内容粘贴进去，**修改密码为你自己设置的强密码**，保存。

---

## 十一、启动所有服务
确保当前在项目根目录（有 `docker-compose.yml` 的目录）：

```bash
cd /var/www/nestjs-prisma7-demo

# 构建镜像并启动所有服务（后台运行）
# --build 强制重新构建镜像
# -d 后台运行（detached mode，不占用终端）
docker compose up --build -d
```

**首次启动会比较慢（3~10 分钟）：**

+ 拉取 `postgres:18-alpine` 和 `nginx:alpine` 镜像
+ 构建 NestJS 应用镜像（npm install + prisma generate + tsc 编译）

**查看启动进度：**

```bash
# 查看所有容器状态
docker compose ps

# 实时查看启动日志（Ctrl+C 退出查看，不影响服务）
docker compose logs -f

# 只看 NestJS 的日志
docker compose logs -f nestjs

# 只看 PostgreSQL 的日志
docker compose logs -f postgres
```

**正常启动后 **`**docker compose ps**`** 输出：**

```plain
NAME               IMAGE              STATUS          PORTS
nestjs_postgres    postgres:18-alpine Up (healthy)    5432/tcp
nestjs_app         ...                Up              0.0.0.0:3000->3000/tcp
nestjs_nginx       nginx:alpine       Up              0.0.0.0:80->80/tcp
```

三个容器都是 `Up` 状态说明启动成功。

---

## 十二、执行数据库迁移
NestJS 启动后，还需要在数据库里建表，执行 Prisma 迁移：

```bash
# 在正在运行的 nestjs 容器里执行迁移命令
# docker compose exec 服务名 命令
docker compose exec nestjs npx prisma migrate deploy
```

`**migrate deploy**`** 和 **`**migrate dev**`** 的区别：**

| 命令 | 用途 | 说明 |
| --- | --- | --- |
| `migrate dev` | 开发环境 | 会创建新的迁移文件，交互式 |
| `migrate deploy` | 生产环境 | 只执行已有的迁移文件，不创建新的，非交互式 |


**执行成功输出：**

```plain
Applying migration `20251130000000_init`

The following migration(s) have been applied:

migrations/
  └─ 20251130000000_init/
       └─ migration.sql

All migrations have been successfully applied.
```

---

## 十三、验证部署成功
### 方式一：浏览器访问
打开浏览器，访问：

```plain
http://你的服务器公网IP/user/list
```

看到 JSON 响应（哪怕是空列表）说明部署成功：

```json
{
  "pagination": { "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 },
  "list": []
}
```

### 方式二：curl 命令测试
```bash
# 在任意机器上执行（替换 IP）
curl http://your-server-ip/user/list

# 测试创建用户
curl -X POST http://your-server-ip/user/create \
  -H "Content-Type: application/json" \
  -d '{"name":"大伟老师","email":"dawei@example.com","password":"123456","role":"admin"}'
```

### 方式三：Apifox 测试
把 Apifox 里所有接口的 Base URL 从 `http://localhost:3000` 改成 `http://your-server-ip`，重新测试所有接口。

---

## 十四、日常运维命令
### 查看容器状态
```bash
# 查看所有容器运行状态
docker compose ps

# 查看容器资源占用（CPU、内存）
docker stats
```

### 查看日志
```bash
# 查看全部服务日志
docker compose logs

# 实时追踪 NestJS 日志
docker compose logs -f nestjs

# 查看最近 100 行日志
docker compose logs --tail=100 nestjs
```

### 更新部署（代码有更新时）
```bash
cd /var/www/nestjs-prisma7-demo

# 拉取最新代码
git pull origin main

# 重新构建并重启（只重启有变化的服务）
docker compose up --build -d

# 如果有新的数据库迁移，执行迁移
docker compose exec nestjs npx prisma migrate deploy
```

### 重启服务
```bash
# 重启所有服务
docker compose restart

# 只重启 NestJS
docker compose restart nestjs

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 数据库数据会丢失，谨慎使用）
docker compose down -v
```

### 进入容器调试
```bash
# 进入 NestJS 容器的 shell
docker compose exec nestjs sh

# 进入 PostgreSQL 容器的数据库命令行
docker compose exec postgres psql -U nestjs_user -d nest_demo

# 进入后可以执行 SQL
\dt              # 查看所有表
SELECT * FROM users;
\q               # 退出
```

### 备份数据库
```bash
# 把 PostgreSQL 数据备份到文件
docker compose exec postgres pg_dump \
  -U nestjs_user nest_demo > backup_$(date +%Y%m%d).sql

# 恢复备份
cat backup_20251130.sql | docker compose exec -T postgres \
  psql -U nestjs_user -d nest_demo
```

### 清理无用镜像（释放磁盘空间）
```bash
# 删除所有未使用的镜像、容器、网络（谨慎使用）
docker system prune -f

# 查看 Docker 占用的磁盘空间
docker system df
```

---

## 十五、常见问题处理
### 问题 1：容器启动后立刻退出
```bash
# 查看容器退出日志
docker compose logs nestjs
```

常见原因：

+ `.env.production` 文件不存在或路径不对
+ `DATABASE_URL` 里的主机名写的是 `localhost`，应该是 `postgres`
+ `prisma.config.ts` 里的 `datasource.url` 没有读取到环境变量

---

### 问题 2：NestJS 启动后无法连接数据库
```plain
Error: P1001: Can't reach database server at postgres:5432
```

原因：NestJS 在 PostgreSQL 还没完全就绪时就尝试连接了。

解决：检查 `docker-compose.yml` 里 nestjs 的 `depends_on` 是否包含健康检查：

```yaml
depends_on:
  postgres:
    condition: service_healthy   # ← 确认有这行
```

---

### 问题 3：80 端口访问不通
可能原因：

1. 云服务器安全组没有开放 80 端口 → 去云控制台添加规则
2. 服务器防火墙没有开放 80 端口 → 执行 `ufw allow 80`
3. Nginx 容器没有启动 → `docker compose ps` 查看状态

---

### 问题 4：镜像构建失败（npm install 报错）
```bash
# 查看详细构建日志
docker compose build --no-cache nestjs 2>&1 | head -100
```

常见原因：

+ 网络问题，npm 下载超时 → 在 Dockerfile 里加 npm 镜像源：

```dockerfile
RUN npm install --registry=https://registry.npmmirror.com
```

---

### 问题 5：数据库迁移失败
```plain
Error: P3006: Migration failed to apply cleanly to the shadow database.
```

原因：生产数据库里已有部分表结构，和迁移文件冲突。

解决（谨慎操作）：

```bash
# 进入容器，手动标记迁移为已执行（不实际执行 SQL）
docker compose exec nestjs npx prisma migrate resolve --applied 20251130000000_init
```

---

### 问题 6：服务器磁盘空间不足
```bash
# 查看磁盘使用情况
df -h

# 查看 Docker 占用
docker system df

# 清理无用镜像
docker image prune -f

# 清理无用容器
docker container prune -f
```

---

## 附：完整文件清单
部署所需的所有文件（在项目根目录）：

```bash
nestjs-prisma7-demo/
├── Dockerfile                  ← 新增：Docker 镜像构建文件
├── docker-compose.yml          ← 新增：多服务编排文件
├── nginx/
│   ├── nginx.conf              ← 新增：Nginx 配置
│   └── ssl/                   ← 新增：SSL 证书目录（暂时为空）
├── .env.production             ← 服务器上手动创建，不提交 Git
├── .gitignore                  ← 确认排除 .env.production
├── prisma/
│   ├── schema.prisma
│   └── migrations/            ← 必须提交 Git
├── prisma.config.ts
├── src/
│   ├── generated/             ← .gitignore 排除，服务器重新生成
│   └── ...
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 附：部署流程一览（完整步骤总结）
```bash
第一次部署：

1. 买服务器（阿里云/腾讯云 2核2GB Ubuntu 22.04）
        ↓
2. SSH 连接服务器，系统初始化，安装 Docker
        ↓
3. 本地准备：写好 Dockerfile + docker-compose.yml + nginx.conf
        ↓
4. 本地代码推送到 Git 仓库
        ↓
5. 服务器：git clone 拉取代码
        ↓
6. 服务器：手动创建 .env.production（填写真实密码）
        ↓
7. 服务器：docker compose up --build -d（构建镜像并启动）
        ↓
8. 服务器：docker compose exec nestjs npx prisma migrate deploy（建表）
        ↓
9. 浏览器访问 http://服务器IP/user/list 验证

────────────────────────────────────────────

后续代码更新：

1. 本地改代码，git push
        ↓
2. 服务器：git pull
        ↓
3. 服务器：docker compose up --build -d
        ↓
4. 如有数据库变更：docker compose exec nestjs npx prisma migrate deploy
```
