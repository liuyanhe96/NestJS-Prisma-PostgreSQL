> 通过 `nest new my-nest-demo` 命令生成的项目，完整目录结构与每个文件的详细说明。
>

---

## 目录结构总览
```markdown
my-nest-demo/
├── src/                          # 源代码目录
│   ├── main.ts                   # 应用入口文件
│   ├── app.module.ts             # 根模块
│   ├── app.controller.ts         # 根控制器
│   ├── app.controller.spec.ts    # 控制器单元测试
│   └── app.service.ts            # 根服务
├── test/                         # 端到端测试目录
│   ├── app.e2e-spec.ts           # e2e 测试文件
│   └── jest-e2e.json             # e2e 测试 Jest 配置
├── dist/                         # 编译输出目录（自动生成）
├── node_modules/                 # 依赖包目录（自动生成）
├── .gitignore                    # Git 忽略规则
├── .prettierrc                   # Prettier 代码格式化配置
├── eslint.config.mjs             # ESLint 代码检查配置
├── nest-cli.json                 # NestJS CLI 配置
├── package.json                  # 项目依赖与脚本配置
├── pnpm-lock.yaml                # pnpm 依赖锁定文件
├── tsconfig.json                 # TypeScript 主配置
├── tsconfig.build.json           # TypeScript 构建专用配置
└── README.md                     # 项目说明文档
```

---

## 一、源代码文件（src/）
### 1. `src/main.ts` — 应用入口文件
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
```

**说明：**

整个应用的启动入口，Node.js 运行时最先执行的文件。

| 代码 | 说明 |
| --- | --- |
| `NestFactory.create(AppModule)` | 使用工厂函数创建 NestJS 应用实例，传入根模块 |
| `process.env.PORT ?? 3002` | 优先读取环境变量 `PORT`，不存在则默认监听 3002 端口 |
| `app.listen(...)` | 启动 HTTP 服务器，开始监听指定端口 |
| `bootstrap()` | 立即调用启动函数（async IIFE 模式） |


---

### 2. `src/app.module.ts` — 根模块
```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**说明：**

NestJS 应用的根模块，所有功能模块都从这里组织起来。`@Module()` 是一个装饰器，用于声明该类是一个模块。

| 装饰器属性 | 类型 | 说明 |
| --- | --- | --- |
| `imports` | 数组 | 导入其他模块，使其导出的 Provider 在当前模块可用。当前为空，表示没有依赖其他模块 |
| `controllers` | 数组 | 注册该模块内的控制器，NestJS 会自动实例化并绑定路由 |
| `providers` | 数组 | 注册服务（Provider），由 NestJS IoC 容器管理，支持依赖注入 |
| `exports` | 数组 | （未使用）将当前模块的 Provider 暴露给导入本模块的其他模块使用 |


**NestJS 模块体系：**

+ NestJS 采用模块化架构，每个功能都应封装在独立模块中
+ 根模块（AppModule）是应用的起点，其他功能模块挂载到它上面
+ 模块之间通过 `imports`/`exports` 共享功能

---

### 3. `src/app.controller.ts` — 根控制器
```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

**说明：**

控制器负责处理 HTTP 请求，将请求路由到对应的处理方法。

| 代码 | 说明 |
| --- | --- |
| `@Controller()` | 声明该类为控制器，括号内可传路由前缀，空表示根路径 `/` |
| `@Get()` | 声明该方法处理 GET 请求，括号内可传路径，空表示当前控制器的根路径 |
| `constructor(private readonly appService: AppService)` | 通过构造函数注入 `AppService`，`private readonly` 是 TypeScript 简写语法，自动声明并赋值为类属性 |
| `getHello()` | 处理 `GET /` 请求，调用服务层方法并返回字符串 |


**控制器职责：**

+ 接收 HTTP 请求
+ 调用服务层（Service）处理业务逻辑
+ 返回 HTTP 响应
+ 不应包含业务逻辑（业务逻辑放在 Service 中）

---

### 4. `src/app.service.ts` — 根服务
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '您好 大伟';
  }
}
```

**说明：**

服务层负责封装业务逻辑，可被控制器或其他服务注入使用。

| 代码 | 说明 |
| --- | --- |
| `@Injectable()` | 声明该类可以被 NestJS IoC 容器管理，允许被注入到其他类中 |
| `getHello()` | 业务方法，返回一个字符串。实际业务中这里会有数据库查询、数据处理等逻辑 |


**服务（Provider）职责：**

+ 封装业务逻辑
+ 访问数据库
+ 调用第三方 API
+ 可被多个控制器复用

---

### 5. `src/app.controller.spec.ts` — 控制器单元测试
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

**说明：**

使用 Jest 框架对 `AppController` 进行单元测试。

| 代码 | 说明 |
| --- | --- |
| `Test.createTestingModule()` | 创建一个测试专用的 NestJS 模块，仅加载测试所需的依赖 |
| `beforeEach` | 每个测试用例执行前运行，重新初始化模块保证测试隔离 |
| `app.get<AppController>()` | 从测试模块的 IoC 容器中获取 `AppController` 实例 |
| `describe` | 测试套件，用于组织相关测试用例 |
| `it` | 单个测试用例 |
| `expect(...).toBe(...)` | 断言：期望返回值等于 `'Hello World!'` |


---

## 二、测试目录（test/）
### 6. `test/app.e2e-spec.ts` — 端到端测试
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

**说明：**

端到端（e2e）测试会启动完整的应用实例，模拟真实 HTTP 请求，测试整个请求链路。

| 代码 | 说明 |
| --- | --- |
| `supertest` | HTTP 测试库，可发送真实 HTTP 请求到应用 |
| `createNestApplication()` | 创建完整的 NestJS 应用实例（包含完整中间件链路） |
| `app.init()` | 初始化应用（触发生命周期钩子等） |
| `request(app.getHttpServer()).get('/')` | 向应用的根路径发送 GET 请求 |
| `.expect(200)` | 断言响应状态码为 200 |
| `.expect('Hello World!')` | 断言响应体为字符串 `'Hello World!'` |


**单元测试 vs e2e 测试：**

+ 单元测试（`*.spec.ts`）：测试单个类/函数，速度快，在 `src/` 目录下
+ e2e 测试（`*.e2e-spec.ts`）：测试完整请求流程，更接近真实场景，在 `test/` 目录下

---

### 7. `test/jest-e2e.json` — e2e 测试 Jest 配置
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

**说明：**

专门为 e2e 测试定制的 Jest 配置，通过 `pnpm test:e2e` 命令使用。

| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `moduleFileExtensions` | `["js", "json", "ts"]` | Jest 识别的文件扩展名 |
| `rootDir` | `"."` | 测试根目录为 `test/` 目录本身（相对于此配置文件） |
| `testEnvironment` | `"node"` | 运行环境为 Node.js（而非浏览器 jsdom） |
| `testRegex` | `".e2e-spec.ts$"` | 匹配所有以 `.e2e-spec.ts` 结尾的文件作为测试文件 |
| `transform` | `{ "^.+\\.(t|j)s$": "ts-jest" }` | 使用 `ts-jest` 将 TypeScript/JavaScript 文件转译后再运行 |


---

## 三、配置文件
### 8. `nest-cli.json` — NestJS CLI 配置
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

**说明：**

NestJS CLI 工具的配置文件，控制 `nest build`、`nest generate`、`nest start` 等命令的行为。

| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `$schema` | URL | JSON Schema 地址，让编辑器提供智能提示和校验 |
| `collection` | `"@nestjs/schematics"` | 代码生成器（schematics）集合，`nest generate` 命令使用此集合生成模块、控制器、服务等代码模板 |
| `sourceRoot` | `"src"` | 源代码根目录，CLI 命令操作的起始路径 |
| `compilerOptions.deleteOutDir` | `true` | 每次构建前自动清空输出目录（`dist/`），避免旧文件残留 |


**其他可选配置项：**

| 配置项 | 说明 |
| --- | --- |
| `entryFile` | 入口文件名，默认 `"main"`（对应 `src/main.ts`） |
| `monorepo` | 是否启用 monorepo 模式，默认 `false` |
| `projects` | monorepo 模式下各子项目的配置 |
| `compilerOptions.webpack` | 是否使用 webpack 打包，默认 `false`（使用 tsc） |
| `compilerOptions.tsConfigPath` | 指定 TypeScript 配置文件路径 |
| `compilerOptions.plugins` | NestJS CLI 插件列表（如 `@nestjs/swagger` 的自动文档插件） |
| `compilerOptions.assets` | 构建时需要复制到输出目录的非 TS 文件（如模板文件、静态资源） |
| `generateOptions.spec` | `nest generate` 时是否自动生成 `.spec.ts` 测试文件，默认 `true` |


---

### 9. `tsconfig.json` — TypeScript 主配置
```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

**说明：**

TypeScript 编译器的主配置文件，控制 TS 如何编译为 JS。

#### 模块系统相关
| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `module` | `"nodenext"` | 输出模块格式，`nodenext` 支持 Node.js 原生 ESM/CJS 双模式，根据 `package.json` 的 `type` 字段自动判断 |
| `moduleResolution` | `"nodenext"` | 模块解析策略，与 `module: nodenext` 配套，完全遵循 Node.js 模块解析规范（需要扩展名、支持 `exports` 字段等） |
| `resolvePackageJsonExports` | `true` | 解析 `package.json` 中的 `exports` 字段来定位模块入口，现代包的标准做法 |
| `esModuleInterop` | `true` | 允许 `import X from 'commonjs-module'` 形式导入 CJS 模块，生成兼容性辅助代码 |
| `allowSyntheticDefaultImports` | `true` | 允许没有 `default export` 的模块使用默认导入语法，配合 `esModuleInterop` 使用 |


#### 编译输出相关
| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `target` | `"ES2023"` | 编译输出的 JavaScript 目标版本，ES2023 支持最新语法特性 |
| `outDir` | `"./dist"` | 编译输出目录 |
| `baseUrl` | `"./"` | 模块路径解析的基准目录，设为项目根目录，配合路径别名使用 |
| `declaration` | `true` | 生成 `.d.ts` 类型声明文件，发布 npm 包时必须开启 |
| `sourceMap` | `true` | 生成 `.js.map` 映射文件，调试时可在 TS 源码上打断点 |
| `removeComments` | `true` | 编译输出中移除所有注释，减小文件体积 |
| `incremental` | `true` | 增量编译，缓存上次编译信息（`.tsbuildinfo`），加速后续编译 |


#### 装饰器相关（NestJS 核心依赖）
| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `experimentalDecorators` | `true` | 启用装饰器语法支持（`@Module()`、`@Controller()` 等），NestJS 必须开启 |
| `emitDecoratorMetadata` | `true` | 编译时注入类型元数据（类型信息），NestJS 依赖注入系统依赖此特性来推断参数类型 |
| `isolatedModules` | `true` | 要求每个文件可以独立编译（不依赖全局类型信息），与 `ts-jest`、`esbuild` 等工具兼容 |


#### 严格性相关
| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `strictNullChecks` | `true` | 严格空值检查，`null` 和 `undefined` 不能赋值给其他类型，防止空指针错误 |
| `noImplicitAny` | `false` | 关闭"禁止隐式 any"检查，允许不声明类型时隐式推断为 `any`（降低入门门槛） |
| `strictBindCallApply` | `false` | 关闭对 `bind`/`call`/`apply` 的严格类型检查 |
| `noFallthroughCasesInSwitch` | `false` | 关闭 switch 语句 case 穿透检查 |
| `forceConsistentCasingInFileNames` | `true` | 强制文件名大小写一致，防止 Windows/Mac/Linux 跨平台大小写问题 |
| `skipLibCheck` | `true` | 跳过 `node_modules` 中 `.d.ts` 文件的类型检查，加快编译速度 |


---

### 10. `tsconfig.build.json` — 构建专用 TypeScript 配置
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

**说明：**

继承主 `tsconfig.json`，专门用于生产构建（`nest build` 命令使用此配置）。

| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `extends` | `"./tsconfig.json"` | 继承主配置的所有选项，避免重复配置 |
| `exclude` | 数组 | 构建时排除以下路径，不编译进 `dist/`： |
| → `"node_modules"` |  | 第三方依赖目录，不需要编译 |
| → `"test"` |  | e2e 测试目录，生产构建不需要 |
| → `"dist"` |  | 输出目录本身，防止递归编译 |
| → `"**/*spec.ts"` |  | 所有单元测试文件（`.spec.ts`），生产构建不需要 |


**为何需要两个 tsconfig：**

+ `tsconfig.json`：完整配置，IDE 和开发工具使用，包含测试文件的类型支持
+ `tsconfig.build.json`：构建专用，排除测试代码，确保生产包干净

---

### 11. `eslint.config.mjs` — ESLint 代码检查配置
```javascript
// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);
```

**说明：**

ESLint 是代码静态分析工具，用于发现代码错误和强制代码风格。此文件使用 ESLint 9 的新 Flat Config 格式（`.mjs` 扩展名）。

#### 配置层（从上到下叠加）
| 配置层 | 说明 |
| --- | --- |
| `ignores: ['eslint.config.mjs']` | 排除 ESLint 配置文件本身，不对其进行检查 |
| `eslint.configs.recommended` | 启用 ESLint 官方推荐规则集（通用 JS 规则） |
| `tseslint.configs.recommendedTypeChecked` | 启用 TypeScript ESLint 推荐规则集，包含需要类型信息的规则（更严格） |
| `eslintPluginPrettierRecommended` | 将 Prettier 格式化规则集成到 ESLint，格式问题作为 ESLint 错误报告 |


#### `languageOptions` 语言配置
| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `globals.node` | Node.js 全局变量 | 添加 Node.js 全局变量（`process`、`__dirname`、`Buffer` 等），避免误报"未定义" |
| `globals.jest` | Jest 全局变量 | 添加 Jest 全局变量（`describe`、`it`、`expect` 等），避免测试文件误报 |
| `sourceType` | `"commonjs"` | 代码模块类型为 CommonJS |
| `parserOptions.projectService` | `true` | 启用 TypeScript 项目服务，让 ESLint 读取 `tsconfig.json` 以获取类型信息 |
| `parserOptions.tsconfigRootDir` | `import.meta.dirname` | TypeScript 配置文件的根目录，即当前配置文件所在目录 |


#### `rules` 规则配置
| 规则 | 值 | 说明 |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | `'off'` | 关闭"禁止显式 any 类型"规则（NestJS 项目中 `any` 较常用） |
| `@typescript-eslint/no-floating-promises` | `'warn'` | 警告：未处理的 Promise（异步调用未加 `await` 或 `.catch()`），仅警告不报错 |
| `@typescript-eslint/no-unsafe-argument` | `'warn'` | 警告：将 `any` 类型值传给类型安全的函数参数，仅警告不报错 |
| `prettier/prettier` | `['error', { endOfLine: 'auto' }]` | Prettier 格式问题作为错误，`endOfLine: 'auto'` 自动适配系统换行符（CRLF/LF） |


---

### 12. `.prettierrc` — Prettier 代码格式化配置
```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

**说明：**

Prettier 是代码自动格式化工具，保证团队代码风格统一。

| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `singleQuote` | `true` | 使用单引号代替双引号（`'hello'` 而非 `"hello"`） |
| `trailingComma` | `"all"` | 在所有合法位置添加尾随逗号（函数参数、对象、数组末尾等），减少 git diff 噪声 |


**其他常用 Prettier 配置（未启用的）：**

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `printWidth` | `80` | 每行最大字符数，超出自动换行 |
| `tabWidth` | `2` | 缩进空格数 |
| `useTabs` | `false` | 是否使用 Tab 缩进（默认用空格） |
| `semi` | `true` | 语句末尾是否加分号 |
| `bracketSpacing` | `true` | 对象字面量花括号内是否加空格（`{ foo: bar }` vs `{foo: bar}`） |
| `arrowParens` | `"always"` | 箭头函数参数是否加括号（`(x) => x` vs `x => x`） |


---

### 13. `.gitignore` — Git 忽略规则
**说明：**

指定哪些文件/目录不提交到 Git 仓库。

| 规则 | 说明 |
| --- | --- |
| `/dist` | 编译输出目录，可由源码重新生成 |
| `/node_modules` | 依赖包目录，体积巨大且可由 `pnpm install` 重新安装 |
| `/build` | 其他构建产物目录 |
| `*.log` / `*-debug.log*` / `*-error.log*` | 各种日志文件 |
| `.DS_Store` | macOS 系统自动生成的文件夹元数据文件 |
| `/coverage` / `/.nyc_output` | 测试覆盖率报告目录 |
| `/.idea` | JetBrains IDE 配置目录 |
| `.vscode/*` | VSCode 配置目录（但保留部分共享配置） |
| `!.vscode/settings.json` | **例外**：保留 VSCode 工作区设置（团队共享） |
| `!.vscode/tasks.json` | **例外**：保留 VSCode 任务配置 |
| `!.vscode/launch.json` | **例外**：保留 VSCode 调试配置 |
| `!.vscode/extensions.json` | **例外**：保留 VSCode 推荐插件列表 |
| `.env` / `.env.*.local` | 环境变量文件，通常含有密钥等敏感信息，绝对不能提交 |
| `.temp` / `.tmp` | 临时目录 |
| `*.pid` / `*.pid.lock` | 进程 ID 文件 |
| `report.[0-9]*.json` | Node.js 诊断报告文件 |


---

### 14. `package.json` — 项目依赖与脚本配置
**说明：**

Node.js 项目的核心配置文件，定义项目元信息、依赖和脚本命令。

#### 基本信息
| 字段 | 值 | 说明 |
| --- | --- | --- |
| `name` | `"my-nest-demo"` | 项目名称 |
| `version` | `"0.0.1"` | 项目版本号（遵循语义化版本） |
| `description` | `""` | 项目描述 |
| `author` | `""` | 作者 |
| `private` | `true` | 防止意外发布到 npm 公共仓库 |
| `license` | `"UNLICENSED"` | 私有项目许可证，表示不开源 |


#### scripts 脚本命令
| 命令 | 执行 | 说明 |
| --- | --- | --- |
| `pnpm build` | `nest build` | 编译 TypeScript 到 `dist/`，使用 `tsconfig.build.json` |
| `pnpm format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | 自动格式化 src 和 test 目录下所有 TS 文件 |
| `pnpm start` | `nest start` | 直接启动（先编译再运行） |
| `pnpm start:dev` | `nest start --watch` | 开发模式：监听文件变化，自动重新编译并重启 |
| `pnpm start:debug` | `nest start --debug --watch` | 调试模式：开启 Node.js 调试端口（9229），配合 VSCode 断点调试 |
| `pnpm start:prod` | `node dist/main` | 生产模式：直接运行编译好的 JS 文件 |
| `pnpm lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | 检查代码规范并自动修复可修复的问题 |
| `pnpm test` | `jest` | 运行所有单元测试（`.spec.ts` 文件） |
| `pnpm test:watch` | `jest --watch` | 监听模式运行测试，文件改变时自动重跑 |
| `pnpm test:cov` | `jest --coverage` | 运行测试并生成覆盖率报告（输出到 `coverage/` 目录） |
| `pnpm test:debug` | `node --inspect-brk ... jest --runInBand` | 调试模式运行测试，可在 Jest 测试中打断点 |
| `pnpm test:e2e` | `jest --config ./test/jest-e2e.json` | 运行端到端测试，使用 `jest-e2e.json` 配置 |


#### dependencies 生产依赖
| 包名 | 版本 | 说明 |
| --- | --- | --- |
| `@nestjs/common` | `^11.0.1` | NestJS 核心包，提供装饰器（`@Module`、`@Controller`、`@Injectable` 等）、管道、守卫、拦截器等 |
| `@nestjs/core` | `^11.0.1` | NestJS 运行时核心，包含 IoC 容器、依赖注入引擎、应用工厂（`NestFactory`） |
| `@nestjs/platform-express` | `^11.0.1` | NestJS 的 Express 适配器，让 NestJS 运行在 Express HTTP 服务器上（可替换为 Fastify） |
| `reflect-metadata` | `^0.2.2` | 装饰器元数据反射库，`emitDecoratorMetadata` 依赖此包，NestJS 依赖注入的基础 |
| `rxjs` | `^7.8.1` | 响应式编程库，NestJS 内部大量使用，也用于 Guards、Interceptors 的流式处理 |


#### devDependencies 开发依赖
| 包名 | 说明 |
| --- | --- |
| `@nestjs/cli` | NestJS 命令行工具，提供 `nest build`、`nest generate` 等命令 |
| `@nestjs/schematics` | 代码生成模板集，`nest generate module/controller/service` 依赖此包 |
| `@nestjs/testing` | NestJS 测试工具，提供 `Test.createTestingModule()` |
| `@types/express` | Express 的 TypeScript 类型声明 |
| `@types/jest` | Jest 的 TypeScript 类型声明（`describe`、`it`、`expect` 的类型） |
| `@types/node` | Node.js 的 TypeScript 类型声明（`process`、`Buffer` 等） |
| `@types/supertest` | supertest 的 TypeScript 类型声明 |
| `eslint` | ESLint 代码检查工具本体 |
| `@eslint/js` | ESLint 官方 JS 规则包 |
| `@eslint/eslintrc` | ESLint 配置工具包 |
| `typescript-eslint` | TypeScript ESLint 规则集成包 |
| `eslint-config-prettier` | 关闭与 Prettier 冲突的 ESLint 规则 |
| `eslint-plugin-prettier` | 将 Prettier 格式化作为 ESLint 规则运行 |
| `globals` | 提供各环境（Node、Browser、Jest等）的全局变量列表 |
| `prettier` | 代码格式化工具本体 |
| `jest` | 测试框架本体 |
| `ts-jest` | Jest 的 TypeScript 转换器，让 Jest 直接运行 TS 文件 |
| `supertest` | HTTP 请求测试库，用于 e2e 测试 |
| `ts-node` | 直接运行 TypeScript 文件（无需预先编译） |
| `ts-loader` | webpack 的 TypeScript 加载器 |
| `tsconfig-paths` | 支持 TypeScript 路径别名（`paths` 配置）在运行时生效 |
| `source-map-support` | 在 Node.js 中启用 Source Map，让错误堆栈显示 TS 源码行号 |
| `typescript` | TypeScript 编译器本体 |


#### jest 测试配置（内嵌在 package.json）
| 配置项 | 值 | 说明 |
| --- | --- | --- |
| `moduleFileExtensions` | `["js", "json", "ts"]` | Jest 识别的模块文件扩展名，按优先级排列 |
| `rootDir` | `"src"` | 测试文件的根目录，Jest 从此目录开始扫描测试文件 |
| `testRegex` | `".*\\.spec\\.ts$"` | 测试文件匹配规则：所有以 `.spec.ts` 结尾的文件 |
| `transform` | `{ "^.+\\.(t|j)s$": "ts-jest" }` | 文件转换规则：TS/JS 文件使用 `ts-jest` 转换 |
| `collectCoverageFrom` | `["**/*.(t|j)s"]` | 收集覆盖率的文件范围：`src/` 下所有 TS/JS 文件 |
| `coverageDirectory` | `"../coverage"` | 覆盖率报告输出目录（相对于 `rootDir` 即 `src/`，所以最终是项目根目录的 `coverage/`） |
| `testEnvironment` | `"node"` | 测试运行环境为 Node.js |


---

### 15. `pnpm-lock.yaml` — 依赖锁定文件
**说明：**

由 pnpm 自动生成和维护，**不要手动编辑**。

+ 精确锁定所有直接和间接依赖的版本号、下载地址、完整性哈希
+ 确保团队所有成员和 CI/CD 环境安装完全相同版本的依赖
+ 应当提交到 Git 仓库中

---

## 四、编译产物（dist/）
由 `pnpm build` 命令自动生成，**不要手动编辑**，已在 `.gitignore` 中排除。

| 文件 | 说明 |
| --- | --- |
| `dist/main.js` | `src/main.ts` 的编译输出 |
| `dist/main.d.ts` | 类型声明文件 |
| `dist/main.js.map` | Source Map 映射文件 |
| `dist/app.module.js` | 模块编译输出 |
| `dist/app.controller.js` | 控制器编译输出 |
| `dist/app.service.js` | 服务编译输出 |
| `dist/tsconfig.build.tsbuildinfo` | TypeScript 增量编译缓存，加速下次构建 |


---

## 五、NestJS 核心概念速览
```markdown
请求 (HTTP Request)
     │
     ▼
┌─────────────┐
│  中间件      │ Middleware（可选）
│  Middleware  │
└─────────────┘
     │
     ▼
┌─────────────┐
│   守卫       │ Guards（权限验证）
│   Guards    │
└─────────────┘
     │
     ▼
┌─────────────┐
│  拦截器      │ Interceptors（前置处理）
│ Interceptor │
└─────────────┘
     │
     ▼
┌─────────────┐
│   管道       │ Pipes（数据验证/转换）
│   Pipes     │
└─────────────┘
     │
     ▼
┌─────────────┐
│  控制器      │ Controller（路由处理）
│ Controller  │ ← app.controller.ts
└─────────────┘
     │
     ▼
┌─────────────┐
│   服务       │ Service（业务逻辑）
│   Service   │ ← app.service.ts
└─────────────┘
     │
     ▼
响应 (HTTP Response)
```

---

## 六、开发常用命令速查
```bash
# 安装依赖
pnpm install

# 开发模式启动（热重载）
pnpm start:dev

# 生产构建
pnpm build

# 生产模式运行
pnpm start:prod

# 代码格式化
pnpm format

# 代码检查并修复
pnpm lint

# 运行单元测试
pnpm test

# 运行 e2e 测试
pnpm test:e2e

# 生成测试覆盖率报告
pnpm test:cov

# 生成新模块（示例）
nest generate module users
nest generate controller users
nest generate service users

# 或简写
nest g mo users
nest g co users
nest g s users
```
