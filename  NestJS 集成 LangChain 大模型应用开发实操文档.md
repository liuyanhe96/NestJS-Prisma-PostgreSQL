# NestJS 集成 LangChain 大模型应用开发实操文档
基于已有项目：nestjs-prisma7-demo（用户模块 + 文章模块） 新建分支：feature/langchain 模型：qwen3.5:0.8b（本地 Ollama 部署） 框架：@langchain/ollama + NestJS 不使用数据库，所有状态保存在内存

---

## 目录
1. 新建分支和集成准备
2. 第三方库详细介绍
3. 全局配置扩展
4. Models — 统一对接 LLM 接口
5. Prompts — 可复用提示词工程
6. Chains — 链式调用固定任务流
7. Agents — 智能代理自主决策
8. Memory — 多轮上下文记忆
9. RAG — 检索增强生成
10. Function Calling — 工具调用
11. app.module.ts 追加注册
12. Apifox 完整测试

---

## 一、新建分支和集成准备
### 1.1 从原有项目新建分支
```bash
# 进入原有项目目录
cd nestjs-prisma7-demo

# 确认当前在 main 分支，且代码是干净的
git status
git branch

# 从 main 新建 langchain 分支并切换过去
git checkout -b feature/langchain

# 确认已切换到新分支
git branch
# * feature/langchain
#   main
```

### 1.2 安装 LangChain 相关依赖
```bash
# 以下是在原有项目基础上追加安装，不影响已有依赖

# 核心：LangChain Ollama 集成包
npm install @langchain/ollama

# 核心：LangChain 基础类型和接口
npm install @langchain/core

# 核心：LangChain 社区集成包（内存向量库 RAG 用）
npm install @langchain/community

# 文本分块器（RAG 用）
npm install @langchain/textsplitters

# LangChain 主包（MemoryVectorStore 在这里）
npm install langchain

# 参数校验（Function Calling / Agents 用）
npm install zod
```

安装完成后 `package.json` 新增的依赖：

```json
{
  "dependencies": {
    "@langchain/community": "^0.3.x",
    "@langchain/core": "^0.3.x",
    "@langchain/ollama": "^0.1.x",
    "@langchain/textsplitters": "^0.1.x",
    "langchain": "^0.3.x",
    "zod": "^3.x"
  }
}
```

### 1.3 拉取 Ollama 模型
```bash
# 对话模型（LLM 推理用）
ollama pull qwen3.5:0.8b

# 向量化模型（RAG 检索用）
ollama pull mxbai-embed-large

# 确认已拉取
ollama list
# 应看到：
# NAME                    ID            SIZE
# qwen3.5:0.8b            f3817196d142  1.0 GB
# mxbai-embed-large       819c2adf5ce6  669 MB
```

### 1.4 集成后的项目目录结构
```plain
nestjs-prisma7-demo/          ← 原有项目根目录
├── src/
│   ├── config.ts             ← 【修改】追加 LangChain 配置
│   ├── app.module.ts         ← 【修改】追加 LangChain 模块注册
│   │
│   ├── prisma/               ← 【原有】Prisma 模块，不动
│   ├── user/                 ← 【原有】用户模块，不动
│   ├── post/                 ← 【原有】文章模块，不动
│   │
│   ├── models/               ← 【新增】LangChain Models 模块
│   │   ├── models.module.ts
│   │   ├── models.controller.ts
│   │   └── models.service.ts
│   ├── prompts/              ← 【新增】LangChain Prompts 模块
│   ├── chains/               ← 【新增】LangChain Chains 模块
│   ├── agents/               ← 【新增】LangChain Agents 模块
│   ├── memory/               ← 【新增】LangChain Memory 模块
│   ├── rag/                  ← 【新增】LangChain RAG 模块
│   └── function-calling/     ← 【新增】Function Calling 模块
│
├── prisma/                   ← 【原有】Prisma Schema，不动
├── prisma.config.ts          ← 【原有】Prisma 配置，不动
├── .env                      ← 【原有】数据库连接字符串，不动
└── package.json              ← 【修改】追加 LangChain 依赖
```

### 1.5 生成新模块
```bash
# 生成所有 LangChain 相关模块（不影响原有 user / post 模块）
nest g module models
nest g controller models
nest g service models

nest g module prompts
nest g controller prompts
nest g service prompts

nest g module chains
nest g controller chains
nest g service chains

nest g module agents
nest g controller agents
nest g service agents

nest g module memory
nest g controller memory
nest g service memory

nest g module rag
nest g controller rag
nest g service rag

nest g module function-calling
nest g controller function-calling
nest g service function-calling
```

---

## 二、第三方库详细介绍
这是本次集成的核心，每个库的定位、为什么需要它、里面有哪些关键类。

### 2.1 `@langchain/ollama` — Ollama 专用集成包
**是什么：** LangChain 官方为 Ollama 单独维护的集成包，2024 年底从 `@langchain/community` 拆出来独立发布。

**解决什么问题：** 把调用本地 Ollama API 的复杂 HTTP 请求封装成简洁的 TypeScript 接口。

```javascript
// 没有 @langchain/ollama 时：手动拼 HTTP 请求
const response = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3.5:0.8b',
    messages: [{ role: 'user', content: '你好' }],
    stream: false,
  }),
})
const data = await response.json()
// 还要手动处理错误、流式解析、类型转换...

// 有了 @langchain/ollama：三行搞定
import { ChatOllama } from '@langchain/ollama'
const llm = new ChatOllama({ model: 'qwen3.5:0.8b' })
const res = await llm.invoke([new HumanMessage('你好')])
```

**核心导出类：**

```javascript
import { ChatOllama } from '@langchain/ollama'
// 用途：对话模型，支持单轮/多轮/流式输出
// 所有 LLM 调用都用这个类

import { OllamaEmbeddings } from '@langchain/ollama'
// 用途：向量化模型，把文本转成向量数组
// RAG 检索时用，把文档和问题都转成向量再做相似度比较
```

**ChatOllama 常用参数：**

```javascript
new ChatOllama({
  model: 'qwen3.5:0.8b',           // 模型名称（必填）
  baseUrl: 'http://localhost:11434', // Ollama 服务地址（默认就是这个）
  temperature: 0.3,                 // 温度：0=保守，1=随机（默认 0.8）
  numCtx: 4096,                     // 上下文窗口大小（token 数）
  numPredict: 512,                  // 最多生成的 token 数
  topK: 40,                         // Top-K 采样参数
  topP: 0.9,                        // Top-P 采样参数
})
```

---

### 2.2 `@langchain/core` — LangChain 核心基础包
**是什么：** LangChain 的基础类型定义和核心接口，所有其他 LangChain 包都依赖它。

**解决什么问题：** 提供统一的消息类型、输出解析器、Prompt 模板、Runnable 接口等基础设施，让所有 LangChain 组件能互相组合。

**核心导出分类：**

```javascript
// ── 消息类型 ──────────────────────────────────────────────
import {
  HumanMessage,    // 用户消息（role: "user"）
  AIMessage,       // 模型回复（role: "assistant"）
  SystemMessage,   // 系统指令（role: "system"）
  ToolMessage,     // 工具调用结果（role: "tool"）
  BaseMessage,     // 所有消息的基类
} from '@langchain/core/messages'

// ── 输出解析器 ────────────────────────────────────────────
import {
  StringOutputParser,  // 把 AIMessage 转成纯字符串（最常用）
  JsonOutputParser,    // 把模型输出解析成 JSON 对象
} from '@langchain/core/output_parsers'

// ── Prompt 模板 ───────────────────────────────────────────
import {
  ChatPromptTemplate,  // 多消息对话模板（支持 system + human）
  PromptTemplate,      // 单消息简单模板
} from '@langchain/core/prompts'

// ── Runnable（链式调用核心）──────────────────────────────
import {
  RunnableSequence,    // 把多个步骤组合成顺序链
  RunnablePassthrough, // 透传输入，不做处理（分叉链用）
  RunnableLambda,      // 把普通函数包装成 Runnable
} from '@langchain/core/runnables'

// ── 工具定义 ─────────────────────────────────────────────
import { tool } from '@langchain/core/tools'
// 把普通函数包装成 Agent / Function Calling 能识别的工具格式
```

**消息类型详解（重要）：**

```javascript
// SystemMessage：设定模型角色，通常放在消息数组第一位
const systemMsg = new SystemMessage('你是一个专业的前端开发导师')

// HumanMessage：用户输入
const humanMsg = new HumanMessage('什么是 Vue3 的 Composition API？')

// AIMessage：模型输出，通常不需要手动创建，invoke 返回的就是这个
const aiMsg = new AIMessage('Composition API 是...')

// ToolMessage：工具调用结果，在 Agents / Function Calling 里用
const toolMsg = new ToolMessage({
  content: '计算结果：42',    // 工具返回的内容
  tool_call_id: 'call_xxx',  // 对应 tool_calls 里的 id
})
```

**pipe（管道）的理解：**

```javascript
// pipe 是 @langchain/core 提供的链式操作符
// 语义：把上一步的输出作为下一步的输入

const chain = prompt.pipe(llm).pipe(parser)
// 等价于：
// const promptResult = await prompt.invoke(input)
// const llmResult = await llm.invoke(promptResult)
// const finalResult = await parser.invoke(llmResult)
```

---

### 2.3 `@langchain/community` — 社区集成包
**是什么：** LangChain 的社区扩展包，集成了几百种第三方工具、数据库、向量存储。

**解决什么问题：** 提供各种第三方服务的统一接口，这个项目里主要用它的向量存储。

**本项目用到的导入：**

```javascript
// 向量存储 - Chroma（如果后续要换成 Chroma 持久化）
import { Chroma } from '@langchain/community/vectorstores/chroma'
// 用法：存储文档向量，支持持久化，重启后数据不丢失

// 说明：本文档用 langchain 主包里的 MemoryVectorStore 替代
// MemoryVectorStore = 内存向量库，不需要启动 Chroma 服务
// 两者 API 完全一样，学完换成 Chroma 只改一行 import
```

**为什么要装这个包（就算不用 Chroma）：**

```javascript
@langchain/ollama 内部依赖 @langchain/community 的部分类型
不装会有 peer dependency 警告，某些场景会报错
```

---

### 2.4 `@langchain/textsplitters` — 文本分块器
**是什么：** LangChain 提供的文本切分工具，把长文档切成适合向量化的小块（Chunk）。

**解决什么问题：** 向量模型有 token 限制，长文档无法整体向量化，需要切成小块分别处理。

**为什么切块的方式很重要：**

```markdown
切太大（1000+ tokens）：
  → 一个向量表达的内容太多，语义被"稀释"
  → 检索时可能返回不相关的内容

切太小（< 100 tokens）：
  → 上下文信息不足，模型回答会缺乏背景
  → 一句话可能被切成两半，语义断裂

重叠（overlap）的作用：
  → 相邻块之间保留部分重叠文字
  → 防止关键信息恰好在切割点被截断
```

**核心类：**

```javascript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

// RecursiveCharacterTextSplitter（最常用）
// "递归"含义：按优先级依次尝试不同分隔符
//   先按 \n\n（段落），太大则按 \n（换行），再按句号，最后按空格

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,       // 每块最大字符数（不是 token 数）
  chunkOverlap: 50,     // 相邻块重叠字符数
  separators: [
    '\n\n',   // 优先级1：段落分隔（保留完整段落）
    '\n',     // 优先级2：换行
    '。',     // 优先级3：中文句号
    '！', '？', '；',
    ' ',      // 优先级5：空格（英文单词边界）
    '',       // 最后手段：强制按字符数切
  ],
})

// createDocuments：把文本切成 Document 对象数组
const chunks = await splitter.createDocuments(
  ['这是一篇很长的文章内容...'],
  [{ source: '文章标题', docId: 'doc-001' }], // 可选的 metadata
)
// chunks[0].pageContent → '文章内容的第一块'
// chunks[0].metadata   → { source: '文章标题', docId: 'doc-001' }
```

---

### 2.5 `langchain` — LangChain 主包
**是什么：** LangChain 的主包，包含高级功能和工具。在新版本（1.x）中，部分模块被拆分到 `@langchain/classic` 等子包里。

**本项目安装但主要作为依赖使用，不直接导入核心模块。**

⚠️ **注意**：`langchain/vectorstores/memory` 这个路径在 langchain 1.x 里已失效，`MemoryVectorStore` 已迁移到 `@langchain/classic`，见下一节。

---

### 2.6 `@langchain/classic` — LangChain 经典兼容包
**是什么：** LangChain 官方提供的兼容包，专门存放从 `langchain` 主包拆出来的"经典"功能模块。`MemoryVectorStore` 在 langchain 1.x 重构后从主包移到了这里。

**安装：**

```bash
npm install @langchain/classic
```

**本项目用到的内容：**

```javascript
// MemoryVectorStore：内存向量库（RAG 核心）
// ⚠️ 注意导入路径：从 @langchain/classic，不是 langchain 主包
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'

// 常见错误路径（会报 Cannot find module）：
// ❌ import { MemoryVectorStore } from 'langchain/vectorstores/memory'
// ❌ import { MemoryVectorStore } from '@langchain/community/vectorstores/memory'
// ✅ import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
```

**为什么用 MemoryVectorStore 而不是 Chroma？**

```plain
MemoryVectorStore（当前，学习演示用）：
  ✅ 零配置，不需要启动任何额外服务
  ✅ API 和 Chroma 完全一样，换库只改一行 import
  ❌ 数据存在内存，重启应用后清空

Chroma（生产环境）：
  ✅ 数据持久化，重启不丢失
  ✅ 支持更大规模的向量数据
  ❌ 需要单独启动 Chroma 服务

pgvector（推荐的生产方案）：
  ✅ 直接用现有 PostgreSQL，不增加新服务
  ✅ 向量 + 关系型数据可以联合查询
  ✅ 数据持久化
```

**MemoryVectorStore 工作原理：**

```javascript
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'

// 1. 构建向量库：把所有文档块向量化并存入内存数组
const vectorStore = await MemoryVectorStore.fromDocuments(
  docs,       // Document[] 数组（已分块的文档）
  embeddings, // OllamaEmbeddings 实例（负责把文字转成向量）
)

// 2. 相似度检索：把 query 向量化，和库里所有向量计算余弦相似度
const results = await vectorStore.similaritySearchWithScore(
  '请假要提前几天？', // 查询文本
  3,                 // 返回前 3 个最相似的结果
)
// results: [Document, score][]
// score 越接近 1 越相关，越接近 0 越不相关
```

---

### 2.7 `zod` — TypeScript 运行时类型校验
**是什么：** TypeScript 生态最流行的运行时类型校验库，用来定义和验证数据结构。

**解决什么问题：** TypeScript 的类型检查只在编译时有效，运行时无法校验外部输入的数据类型。Zod 在运行时校验，并且自动生成 TypeScript 类型。

**在 LangChain 里的作用：** 定义工具（Tool）的参数 Schema，让模型知道调用工具时需要传什么参数、什么类型。

```javascript
import { z } from 'zod'

// 定义对象 Schema
const UserSchema = z.object({
  name: z.string().describe('用户名'),
  age: z.number().min(0).max(150).describe('年龄，0-150之间'),
  email: z.string().email().optional().describe('邮箱，可选'),
})

// 运行时校验（编译通过不代表运行时正确）
const result = UserSchema.safeParse({ name: '大伟', age: 30 })
if (result.success) {
  console.log(result.data)  // 校验通过，data 有完整类型
} else {
  console.log(result.error) // 校验失败，打印具体错误
}

// 从 Schema 提取 TypeScript 类型
type User = z.infer<typeof UserSchema>
  // 等价于：
  // type User = { name: string; age: number; email?: string }
```

**在 Function Calling / Agents 里的具体用法：**

```javascript
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const calculatorTool = tool(
  async ({ expression }) => {
    // expression 已经被 zod 校验过，类型是 string
    return String(eval(expression))
  },
  {
    name: 'calculator',
    description: '计算数学表达式',
    // schema 告诉模型：调用这个工具需要传 expression 字段，类型是字符串
    // describe() 里的文字帮助模型理解每个参数的用途
    schema: z.object({
      expression: z.string().describe('数学表达式，例如 2+3*4'),
    }),
  },
)
```

---

### 2.8 各包的协作关系图
```markdown
用户请求
    ↓
NestJS Controller
    ↓
NestJS Service
    ↓
┌─────────────────────────────────────────────────┐
│                  LangChain 层                    │
│                                                 │
│  @langchain/core（基础类型）                      │
│    ├── HumanMessage / AIMessage / SystemMessage  │
│    ├── ChatPromptTemplate / PromptTemplate       │
│    ├── StringOutputParser / JsonOutputParser     │
│    ├── RunnableSequence / RunnablePassthrough    │
│    └── tool()                                   │
│                                                 │
│  zod（参数校验）                                  │
│    └── 定义 Tool 的参数 Schema                   │
│                                                 │
│  @langchain/textsplitters（文档处理）             │
│    └── RecursiveCharacterTextSplitter            │
│                                                 │
│  @langchain/classic（经典兼容包）                 │
│    └── MemoryVectorStore（内存向量库，RAG用）     │
│                                                 │
│  @langchain/community（社区集成）                 │
│    └── Chroma（生产向量库，可替换 Memory）        │
│                                                 │
└──────────────────┬──────────────────────────────┘
                   ↓
         @langchain/ollama（Ollama 对接）
           ├── ChatOllama（对话模型）
           └── OllamaEmbeddings（向量化模型）
                   ↓
         Ollama HTTP API（localhost:11434）
                   ↓
         qwen3.5:0.8b（对话）
         mxbai-embed-large（向量化）
```

---

## 三、全局配置扩展
在原有项目的 `src/config.ts` 里**追加** LangChain 配置（原有 Prisma 配置保持不动）：

```javascript
// src/config.ts
// 在原有配置基础上追加 LangChain 配置

export const config = {
  // ── 原有配置（不动）─────────────────────────────────────
  // 如果原项目有 server、chroma 等配置，保留在这里

  // ── 新增：Ollama / LangChain 配置 ───────────────────────
  ollama: {
    // Ollama 服务地址，默认本机 11434 端口
    baseUrl: 'http://localhost:11434',

    // 对话模型：qwen3.5:0.8b（约 1GB）
    // 拉取命令：ollama pull qwen3.5:0.8b
    chatModel: 'qwen3.5:0.8b',

    // 向量化模型：mxbai-embed-large（RAG 检索用，约 669MB）
    // 拉取命令：ollama pull mxbai-embed-large
    embedModel: 'mxbai-embed-large',

    // 温度参数（0~1）
    // 0   = 最保守，每次输出几乎相同，适合问答/代码
    // 0.3 = 稍有变化，适合大多数场景
    // 0.7 = 较有创意，适合写作
    // 1.0 = 最随机，适合头脑风暴
    temperature: 0.3,
  },
}
```

---

## 四、Models — 统一对接 LLM 接口
### 4.1 概念说明
Models 是 LangChain 最基础的模块，把"调用大模型"抽象成统一接口。

```plain
不用 LangChain：每种模型有不同 API 格式，换模型要大改代码
用 LangChain：统一用 .invoke() / .stream()，换模型只改构造参数
```

### 4.2 models.service.ts
```javascript
// src/models/models.service.ts

import { Injectable } from '@nestjs/common'
import { Response } from 'express'
import { ChatOllama } from '@langchain/ollama'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { config } from '../config'

@Injectable()
  export class ModelsService {
    // 创建 ChatOllama 实例
    // 整个 Service 共用一个实例（NestJS Service 默认单例）
    private llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: config.ollama.temperature,
    })

    // ── 方式一：基础调用（等待完整回答）────────────────────
    // invoke 发送消息数组，等模型生成完整回答后一次性返回
    // 适合：普通问答，不需要流式效果
    async basicChat(message: string) {
      const response = await this.llm.invoke([
        new HumanMessage(message),
      ])
      // response 是 AIMessage 对象
      // response.content → 模型回答的文字
      // response.usage_metadata → token 消耗统计
      return {
        question: message,
        answer: response.content,
        usage: response.usage_metadata,
      }
    }

    // ── 方式二：带 System Prompt ────────────────────────────
    // SystemMessage 设定模型角色，必须放在消息数组第一位
    async chatWithSystem(system: string, message: string) {
      const response = await this.llm.invoke([
        new SystemMessage(system),  // 角色设定
        new HumanMessage(message),  // 用户问题
      ])
      return {
        system,
        question: message,
        answer: response.content,
      }
    }

    // ── 方式三：SSE 流式输出 ────────────────────────────────
    // stream 返回 AsyncGenerator，每次 yield 一个文字片段（chunk）
    // 适合：需要逐字显示的场景（像 ChatGPT 那样打字效果）
    async streamChat(message: string, res: Response) {
      // 设置 SSE 响应头，告诉浏览器这是事件流
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', '*')

      const stream = await this.llm.stream([
        new HumanMessage(message),
      ])

      // 逐个 chunk 推送给客户端
      // SSE 格式固定：data: JSON字符串\n\n
      for await (const chunk of stream) {
        if (chunk.content) {
          res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`)
        }
      }

      // 发送结束标记，前端据此判断流结束
      res.write('data: [DONE]\n\n')
      res.end()
    }

    // ── 方式四：pipe 链（StringOutputParser）───────────────
    // pipe 把多个组件串联成链，输出类型从 AIMessage 变成 string
    async chatWithParser(message: string) {
      // prompt → llm → parser 三步流水线
      // StringOutputParser 把 AIMessage.content 提取成纯字符串
      const chain = this.llm.pipe(new StringOutputParser())
      const answer = await chain.invoke([new HumanMessage(message)])
      // answer 直接是字符串，不是 AIMessage 对象
      return { question: message, answer }
    }
  }
```

### 4.3 models.controller.ts
```javascript
// src/models/models.controller.ts

import { Controller, Post, Body, Res } from '@nestjs/common'
import { Response } from 'express'
import { ModelsService } from './models.service'

@Controller('models')
  export class ModelsController {
    constructor(private readonly modelsService: ModelsService) {}

    @Post('chat')
    basicChat(@Body() body: { message: string }) {
      return this.modelsService.basicChat(body.message)
    }

    @Post('chat-system')
    chatWithSystem(@Body() body: { system: string; message: string }) {
      return this.modelsService.chatWithSystem(body.system, body.message)
    }

    @Post('chat-stream')
    streamChat(@Body() body: { message: string }, @Res() res: Response) {
      return this.modelsService.streamChat(body.message, res)
    }

    @Post('chat-parser')
    chatWithParser(@Body() body: { message: string }) {
      return this.modelsService.chatWithParser(body.message)
    }
  }
```

---

## 五、Prompts — 可复用提示词工程
### 5.1 概念说明
Prompts 把提示词模板化，同一类任务复用同一个模板，变量动态注入。

```plain
手动拼字符串（不推荐）：
  const prompt = `把"${text}"翻译成${lang}`   // 容易拼错，无法复用

ChatPromptTemplate（推荐）：
  const template = ChatPromptTemplate.fromMessages([
    ['system', '你是翻译专家'],
    ['human', '把"{text}"翻译成{lang}'],
  ])
  await template.invoke({ text: 'Hello', lang: '中文' })
  // {text} 和 {lang} 是占位符，自动替换
```

### 5.2 prompts.service.ts
```javascript
// src/prompts/prompts.service.ts

import { Injectable } from '@nestjs/common'
import { ChatOllama } from '@langchain/ollama'
import {
  ChatPromptTemplate,
  PromptTemplate,
  FewShotPromptTemplate,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { config } from '../config'

@Injectable()
  export class PromptsService {
    private llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: config.ollama.temperature,
    })

    // ── ChatPromptTemplate：多消息对话模板（最常用）─────────
    // fromMessages 接收 [role, content] 数组
    // role 可以是 'system' | 'human' | 'ai'
    // content 里的 {变量名} 是占位符，invoke 时替换
    async translateText(text: string, targetLang: string) {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', '你是专业翻译，只输出翻译结果，不加任何解释。'],
        ['human', '请把以下内容翻译成{targetLang}：\n\n{text}'],
      ])

      // pipe 把 prompt、llm、parser 串联
      // prompt.invoke({ text, targetLang }) → 格式化后的消息数组
      // llm.invoke(消息数组) → AIMessage
      // parser.invoke(AIMessage) → 纯字符串
      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
      const result = await chain.invoke({ text, targetLang })

      return { original: text, targetLang, translated: result }
    }

    // ── PromptTemplate：单消息简单模板──────────────────────
    // 比 ChatPromptTemplate 简单，只有一条 human 消息
    async summarizeText(text: string, maxWords: number) {
      const prompt = PromptTemplate.fromTemplate(
        '用不超过{maxWords}个字总结以下内容，只输出总结：\n\n{text}',
      )
      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
      const result = await chain.invoke({ text, maxWords })

      return { original: text, maxWords, summary: result }
    }

    // ── FewShotPromptTemplate：少样本学习模板───────────────
    // 给模型几个示例，让它学会输出格式
    // 适合需要严格控制输出格式的分类、提取任务
    async classifyText(text: string) {
      // 示例数组：展示正确的输入→输出映射
      const examples = [
        { input: '这个产品太棒了！', output: '正面' },
        { input: '完全不值这个价格', output: '负面' },
        { input: '还可以吧，普通', output: '中性' },
        { input: '强烈推荐！超出预期', output: '正面' },
        { input: '很失望，不会再买了', output: '负面' },
      ]

      // 每个示例的格式模板
      const examplePrompt = PromptTemplate.fromTemplate(
        '输入：{input}\n输出：{output}',
      )

      const fewShotPrompt = new FewShotPromptTemplate({
        examples,
        examplePrompt,
        prefix: '分析文本情感，只输出：正面、负面、中性之一。\n\n示例：',
        suffix: '输入：{input}\n输出：',
        inputVariables: ['input'],
      })

      const formattedPrompt = await fewShotPrompt.format({ input: text })
      const response = await this.llm.invoke(formattedPrompt)

      return { text, sentiment: String(response.content).trim() }
    }

    // ── 代码审查：复杂 System Prompt 示例──────────────────
    async codeReview(code: string, language: string) {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `你是资深{language}开发工程师，负责代码审查。
审查维度：代码规范 / 潜在 Bug / 性能问题 / 改进建议
输出格式：总体评分（1-10分）+ 具体问题列表 + 改进代码片段`,
        ],
        ['human', '请审查以下{language}代码：\n\n\`\`\`{language}\n{code}\n\`\`\`'],
    ])

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const result = await chain.invoke({ code, language })

    return { language, code, review: result }
  }
}
```

### 5.3 prompts.controller.ts
```javascript
// src/prompts/prompts.controller.ts

import { Controller, Post, Body } from '@nestjs/common'
import { PromptsService } from './prompts.service'

@Controller('prompts')
  export class PromptsController {
    constructor(private readonly promptsService: PromptsService) {}

    @Post('translate')
    translate(@Body() body: { text: string; targetLang: string }) {
      return this.promptsService.translateText(body.text, body.targetLang)
    }

    @Post('summarize')
    summarize(@Body() body: { text: string; maxWords: number }) {
      return this.promptsService.summarizeText(body.text, body.maxWords)
    }

    @Post('classify')
    classify(@Body() body: { text: string }) {
      return this.promptsService.classifyText(body.text)
    }

    @Post('code-review')
    codeReview(@Body() body: { code: string; language: string }) {
      return this.promptsService.codeReview(body.code, body.language)
    }
  }
```

---

## 六、Chains — 链式调用固定任务流
### 6.1 概念说明
Chain 把多个步骤串联成流水线，每步输出作为下步输入。

```plain
适用场景：
  任务流程固定、步骤顺序确定
  例如：分析 → 润色、关键词 → 大纲 → 文章

和 Agent 的区别：
  Chain = 工厂流水线（步骤写死，自动执行）
  Agent = 聪明员工（自己决定做什么、做几步）
```

### 6.2 chains.service.ts
```javascript
// src/chains/chains.service.ts

import { Injectable } from '@nestjs/common'
import { ChatOllama } from '@langchain/ollama'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables'
import { config } from '../config'

@Injectable()
  export class ChainsService {
    private llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: config.ollama.temperature,
    })
    private parser = new StringOutputParser()

    // ── 多步骤链：文章润色（分析问题 → 润色文章）──────────
    // RunnableSequence：把多个步骤组合成顺序链
    // RunnablePassthrough：透传输入值（用于在分叉步骤保留原始输入）
    async polishArticle(article: string) {
      const analyzePrompt = ChatPromptTemplate.fromMessages([
        ['system', '你是专业编辑，只输出问题列表，不要其他内容。'],
        ['human', '分析这篇文章存在的问题：\n\n{article}'],
      ])

      const polishPrompt = ChatPromptTemplate.fromMessages([
        ['system', '你是专业编辑，根据问题列表润色原文，保持原意。'],
        ['human', '原文：\n{article}\n\n问题：\n{issues}\n\n请输出润色后的文章：'],
      ])

      // 第一条链：article字符串 → 分析 → issues字符串
      const analyzeChain = analyzePrompt.pipe(this.llm).pipe(this.parser)

      // RunnableSequence：分两步执行
      // 步骤1：同时保留 article 原文 + 调用 analyzeChain 得到 issues
      // 步骤2：把 { article, issues } 传给 polishChain 润色
      const fullChain = RunnableSequence.from([
        {
          article: new RunnablePassthrough(), // 原文直接透传
          issues: analyzeChain,               // 分析链得到问题列表
        },
        polishPrompt.pipe(this.llm).pipe(this.parser),
      ])

      const result = await fullChain.invoke(article)
      return { original: article, polished: result }
    }

    // ── 顺序链：博客生成（关键词→大纲→文章→SEO标题）──────
    async generateBlog(keywords: string, style: string) {
      // 三条独立链，顺序执行，上一步输出传给下一步
      const outlineChain = ChatPromptTemplate.fromMessages([
        ['system', '你是专业博客作者，只输出大纲，不要正文。'],
        ['human', '根据关键词"{keywords}"，写一篇{style}风格的博客大纲（3-5个章节）'],
      ]).pipe(this.llm).pipe(this.parser)

      const articleChain = ChatPromptTemplate.fromMessages([
        ['system', '你是专业博客作者，按照大纲写完整文章。'],
        ['human', '大纲：\n{outline}\n\n请写出完整的博客文章：'],
      ]).pipe(this.llm).pipe(this.parser)

      const titleChain = ChatPromptTemplate.fromMessages([
        ['system', '你是SEO专家，只输出5个候选标题。'],
        ['human', '根据以下文章生成5个吸引点击的标题：\n\n{article}'],
      ]).pipe(this.llm).pipe(this.parser)

      const outline = await outlineChain.invoke({ keywords, style })
      const article = await articleChain.invoke({ outline })
      const titles = await titleChain.invoke({ article })

      return { keywords, style, outline, article, seoTitles: titles }
    }

    // ── 条件分支链：客服路由（分类 → 路由到不同处理链）────
    async smartRouter(question: string) {
      // 第一步：分类
      const classifyChain = ChatPromptTemplate.fromMessages([
        [
          'system',
          `分析用户问题，只输出分类标签：
技术问题 → TECH
退款问题 → REFUND
投诉建议 → COMPLAINT
其他 → OTHER`,
        ],
        ['human', '{question}'],
      ]).pipe(this.llm).pipe(this.parser)

    const category = (await classifyChain.invoke({ question })).trim()

    // 第二步：根据分类选择对应 System Prompt
    const systemMap: Record<string, string> = {
      TECH: '你是技术支持专家，给出具体操作步骤。',
      REFUND: '你是退款专员，引导完成退款流程，态度友好。',
      COMPLAINT: '你是客户关系专员，认真对待投诉，给出解决方案。',
      OTHER: '你是通用客服，友好回答各类问题。',
    }

    const systemPrompt = systemMap[category] || systemMap.OTHER

    const answerChain = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', '{question}'],
    ]).pipe(this.llm).pipe(this.parser)

    const answer = await answerChain.invoke({ question })
    return { question, category, answer }
  }
}
```

### 6.3 chains.controller.ts
```javascript
// src/chains/chains.controller.ts

import { Controller, Post, Body } from '@nestjs/common'
import { ChainsService } from './chains.service'

@Controller('chains')
  export class ChainsController {
    constructor(private readonly chainsService: ChainsService) {}

    @Post('polish')
    polishArticle(@Body() body: { article: string }) {
      return this.chainsService.polishArticle(body.article)
    }

    @Post('blog')
    generateBlog(@Body() body: { keywords: string; style: string }) {
      return this.chainsService.generateBlog(body.keywords, body.style)
    }

    @Post('router')
    smartRouter(@Body() body: { question: string }) {
      return this.chainsService.smartRouter(body.question)
    }
  }
```

---

## 七、Agents — 智能代理自主决策
### 7.1 概念说明
Agent 和 Chain 的核心区别：

```plain
Chain（固定流程）：步骤提前写死，模型只负责生成内容
  用户 → 步骤1 → 步骤2 → 步骤3 → 结束
  问题：换了用户意图，整条链就跑不通

Agent（自主决策）：模型自己决定调哪个工具、调几次
  用户说什么 → 模型思考 → 决定调工具A → 看结果 → 再决定 → 最终回答
  优势：同一套代码，处理查库存/下单/查订单/退款多种意图
```

**录视频时的核心对比话术：**

```plain
问：用 Chain 实现"先查库存再下单"怎么写？
  → 要提前写死：step1 查库存、step2 下单，步骤固定

再问：如果用户说"查一下我的订单"，这条 Chain 能处理吗？
  → 不能，Chain 是固定流程

Agent 的价值：
  → 不需要提前写死流程
  → 模型自己看用户说什么，决定调哪个工具、调几次
  → 同一套代码，灵活处理多种业务意图
```

**本节示例：极速购电商 AI 智能客服**

```plain
用户：「我叫大伟，帮我买一台 MacBook Pro」

Agent 自主决策流程：
  思考：用户想购买，但我需要先确认商品是否有货
  行动：调用 check_product → 「MacBook Pro 有货，¥15999」
  思考：有货，用户已报名字，可以直接下单
  行动：调用 create_order → 「订单 ORD-960000 创建成功」
  思考：任务完成，给用户完整答复
  输出：「张三您好！MacBook Pro 有货已下单，订单号 ORD-960000，总价 ¥15999」

Agent 自主串联了两个工具，代码里没有写死这个顺序。
```

### 7.2 agents.service.ts
```javascript
// src/agents/agents.service.ts

import { Injectable } from '@nestjs/common'
import { ChatOllama } from '@langchain/ollama'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from '@langchain/core/messages'
import { config } from '../config'

@Injectable()
  export class AgentsService {
    private llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: 0.1,   // 低温度，让工具调用决策更稳定
      think: false,
      numPredict: 1024,
    })

    // ══════════════════════════════════════════════════════
    // 工具定义
    // tool() 把普通 JS 函数包装成模型能识别的格式
    //   name：工具名（模型据此决定何时调用）
    //   description：工具描述（模型据此理解这个工具能干什么）
    //   schema：参数定义（zod 格式，告诉模型调用时传什么参数）
    // ══════════════════════════════════════════════════════

    // ── 工具一：查询商品库存和价格 ──────────────────────────
    private checkProductTool = tool(
      async ({ productName }: { productName: string }) => {
        console.log(`[工具执行] check_product → 查询商品：${productName}`)

        // 模拟商品数据库（实际项目注入 PrismaService 查真实数据库）
        const products: Record<string, { price: number; stock: number; category: string }> = {
    'iPhone 16':      { price: 7999,  stock: 50, category: '手机' },
    'iPhone 16 Pro':  { price: 9999,  stock: 20, category: '手机' },
    'MacBook Pro':    { price: 15999, stock: 8,  category: '电脑' },
    'AirPods Pro':    { price: 1799,  stock: 200, category: '耳机' },
    'iPad Air':       { price: 4799,  stock: 30, category: '平板' },
  }

const product = products[productName]

if (!product) {
  return `商品「${productName}」不存在，请检查商品名称是否正确。`
}
if (product.stock === 0) {
  return `商品「${productName}」当前缺货，预计下周补货。`
}

return `商品「${productName}」有货，单价 ¥${product.price}，库存 ${product.stock} 件，分类：${product.category}。`
},
{
  name: 'check_product',
    // description 非常关键：模型根据这段描述决定何时调用这个工具
    description: '查询商品是否有货、商品价格和库存数量。用户问"有没有XX"、"XX多少钱"、"XX有货吗"时调用。',
    schema: z.object({
    productName: z.string().describe('商品名称，例如 iPhone 16、MacBook Pro'),
  }),
    },
    )

    // ── 工具二：创建订单 ────────────────────────────────────
    private createOrderTool = tool(
    async ({ productName, quantity, customerName }: {
      productName: string
      quantity: number
      customerName: string
    }) => {
      console.log(`[工具执行] create_order → ${customerName} 购买 ${productName} x${quantity}`)

      const prices: Record<string, number> = {
      'iPhone 16': 7999, 'iPhone 16 Pro': 9999,
      'MacBook Pro': 15999, 'AirPods Pro': 1799, 'iPad Air': 4799,
    }

    const unitPrice = prices[productName] ?? 0
  const totalPrice = unitPrice * quantity
  // 生成简短订单号，便于演示
  const orderId = `ORD-${Date.now().toString().slice(-6)}`

  return `订单创建成功！订单号：${orderId}，客户：${customerName}，商品：${productName} x${quantity}，单价 ¥${unitPrice}，总价 ¥${totalPrice}。请在 30 分钟内完成支付。`
},
{
  name: 'create_order',
    description: '为客户创建购买订单。需要知道商品名称、购买数量、客户姓名才能下单。用户说"我要买XX"、"帮我下单"时调用。',
      schema: z.object({
        productName:  z.string().describe('商品名称'),
        quantity:     z.number().describe('购买数量，默认为 1'),
        customerName: z.string().describe('客户姓名'),
      }),
    },
  )

  // ── 工具三：查询订单状态 ────────────────────────────────
  private checkOrderTool = tool(
    async ({ orderId }: { orderId: string }) => {
      console.log(`[工具执行] check_order → 查询订单：${orderId}`)

      // 模拟订单状态（实际项目查数据库）
      const statuses = ['待支付', '已支付待发货', '已发货运输中', '已签收']
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const extra = status === '已发货运输中' ? '，预计明天送达' : ''

      return `订单 ${orderId} 当前状态：${status}${extra}。`
    },
    {
      name: 'check_order',
      description: '查询订单的当前状态。用户说"我的订单"、"订单到哪了"、"查一下订单 ORD-XXX"时调用。',
      schema: z.object({
        orderId: z.string().describe('订单号，格式为 ORD-XXXXXX'),
      }),
    },
  )

  // ── 工具四：申请退款 ────────────────────────────────────
  private applyRefundTool = tool(
    async ({ orderId, reason }: { orderId: string; reason: string }) => {
      console.log(`[工具执行] apply_refund → 订单 ${orderId}，原因：${reason}`)

      const refundId = `REF-${Date.now().toString().slice(-6)}`
      return `退款申请已提交！退款单号：${refundId}，订单：${orderId}，退款原因：${reason}。预计 1-3 个工作日内退回原支付渠道，请注意查收。`
    },
    {
      name: 'apply_refund',
      description: '为客户申请订单退款。用户说"我要退款"、"申请退货"、"不想要了"时调用。需要订单号和退款原因。',
      schema: z.object({
        orderId: z.string().describe('需要退款的订单号'),
        reason:  z.string().describe('退款原因，例如：质量问题、不喜欢、买错了'),
      }),
    },
  )

  // ══════════════════════════════════════════════════════
  // Agent 核心执行逻辑
  // ══════════════════════════════════════════════════════
  async runAgent(userMessage: string) {
    const tools = [
      this.checkProductTool,
      this.createOrderTool,
      this.checkOrderTool,
      this.applyRefundTool,
    ]

    const toolMap: Record<string, any> = {
      check_product:  this.checkProductTool,
      create_order:   this.createOrderTool,
      check_order:    this.checkOrderTool,
      apply_refund:   this.applyRefundTool,
    }

    // bindTools：把工具列表注册到模型
    // 注册后模型回复里会包含 tool_calls 字段（当它决定调用工具时）
    const llmWithTools = this.llm.bindTools(tools)

    // 消息历史：Agent 每一轮都能看到完整的对话 + 工具结果
    const messages: any[] = [
      // System 消息：设定客服角色和行为规范
      new SystemMessage(
        `你是「极速购」电商平台的 AI 智能客服助手。
你可以使用以下工具帮助客户：
- check_product：查询商品库存和价格
- create_order：为客户创建订单
- check_order：查询订单状态
- apply_refund：申请退款

工作原则：
1. 先用工具获取真实信息，再给客户答复
2. 下单前必须先查询库存确认有货
3. 下单需要知道客户姓名，如果用户没说，主动询问
4. 回答简洁友好，使用中文`,
      ),
      new HumanMessage(userMessage),
    ]

    // 记录每步执行过程（用于前端展示 / 课程演示）
    const steps: string[] = []
    let roundCount = 0

    // ── Agent 循环 ──────────────────────────────────────
    // 每一轮：模型看消息历史 → 决定调用工具还是直接回答
    // 直到模型不再调用工具为止（最多 6 轮，防止死循环）
    while (roundCount < 6) {
      roundCount++
      console.log(`\n[Agent 第 ${roundCount} 轮]`)

      const response = await llmWithTools.invoke(messages)
      messages.push(response)  // 把模型回复加入历史

      // tool_calls 为空 → 模型有了最终答案，退出循环
      if (!response.tool_calls || response.tool_calls.length === 0) {
        steps.push(`💬 [最终回答] ${response.content}`)
        break
      }

      // 模型决定调用工具，依次执行所有工具调用
      for (const toolCall of response.tool_calls) {
        steps.push(`🔧 [调用工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`)
        console.log(`[工具调用] ${toolCall.name}`, toolCall.args)

        const toolFn = toolMap[toolCall.name]
        if (!toolFn) {
          const errMsg = `工具「${toolCall.name}」不存在`
          steps.push(`❌ [错误] ${errMsg}`)
          messages.push(new ToolMessage({ content: errMsg, tool_call_id: toolCall.id }))
          continue
        }

        // 执行工具，获取结果
        const toolResult = await toolFn.invoke(toolCall.args)
        steps.push(`✅ [工具结果] ${toolResult}`)
        console.log(`[工具结果] ${toolResult}`)

        // 把工具结果加入消息历史
        // 模型下一轮看到结果后，再决定继续调工具还是直接回答
        messages.push(
          new ToolMessage({
            content: String(toolResult),
            tool_call_id: toolCall.id,
          }),
        )
      }
    }

    // 获取最终回答（最后一条 AIMessage 的内容）
    const lastAI = [...messages].reverse().find(m => m instanceof AIMessage)

    return {
      userMessage,
      steps,            // 完整思考和执行步骤（录视频演示重点）
      totalRounds: roundCount,
      answer: lastAI?.content ?? '抱歉，暂时无法处理您的请求',
    }
  }
}
```

### 7.3 agents.controller.ts
```javascript
// src/agents/agents.controller.ts

import { Controller, Post, Body } from '@nestjs/common'
import { AgentsService } from './agents.service'

@Controller('agents')
  export class AgentsController {
    constructor(private readonly agentsService: AgentsService) {}

    @Post('run')
    runAgent(@Body() body: { message: string }) {
      return this.agentsService.runAgent(body.message)
    }
  }
```

## 八、Memory — 多轮上下文记忆
### 8.1 概念说明
模型本身是无状态的，每次 invoke 都是全新对话。Memory 通过手动维护消息历史，把上文注入每次请求，实现"记忆"效果。

```plain
原理：
  用 Map<sessionId, BaseMessage[]> 存每个会话的历史
  每次发消息：取出历史 → 追加新消息 → 发给模型 → 把回复存回历史

sessionId 作为会话标识，同一个 sessionId 共享一份历史
```

### 8.2 memory.service.ts
```javascript
// src/memory/memory.service.ts

import { Injectable } from '@nestjs/common'
import { Response } from 'express'
import { ChatOllama } from '@langchain/ollama'
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages'
import { config } from '../config'

@Injectable()
  export class MemoryService {
    private llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: config.ollama.temperature,
    })

    // 会话存储：sessionId → 消息历史数组
    // NestJS Service 是单例，Map 在整个应用生命周期内存在
    private sessions = new Map<string, BaseMessage[]>()

      private systemMessage = new SystemMessage(
      '你是一个智能助手，能记住对话历史，根据上下文准确回答。',
    )

    private getOrCreate(sessionId: string): BaseMessage[] {
      if (!this.sessions.has(sessionId)) {
        // 新会话：初始化时加入 SystemMessage
        this.sessions.set(sessionId, [this.systemMessage])
      }
      return this.sessions.get(sessionId)!
    }

    // ── 多轮对话（REST 版本）──────────────────────────────
    async chat(sessionId: string, message: string) {
      const history = this.getOrCreate(sessionId)

      // 把用户新消息加入历史
      history.push(new HumanMessage(message))

      // 把完整历史发给模型（包含 System + 所有历史 + 本次消息）
      // 模型看到完整上下文，能理解之前说了什么
      const response = await this.llm.invoke(history)

      // 把模型回复也加入历史，下次对话继续携带
      history.push(response)

      return {
        sessionId,
        message,
        reply: response.content,
        turns: Math.floor((history.length - 1) / 2), // 对话轮次
      }
    }

    // ── 多轮对话（SSE 流式版本）──────────────────────────
    async chatStream(sessionId: string, message: string, res: Response) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', '*')

      const history = this.getOrCreate(sessionId)
      history.push(new HumanMessage(message))

      let fullReply = ''

      const stream = await this.llm.stream(history)
      for await (const chunk of stream) {
        if (chunk.content) {
          const text = String(chunk.content)
          fullReply += text
          res.write(`data: ${JSON.stringify({ text, sessionId })}\n\n`)
        }
      }

      // 流结束后把完整回复存入历史
      history.push(new AIMessage(fullReply))
      res.write(`data: ${JSON.stringify({ text: '[DONE]', turns: Math.floor((history.length - 1) / 2) })}\n\n`)
      res.end()
    }

    // ── 查看会话历史 ──────────────────────────────────────
    getHistory(sessionId: string) {
      const history = this.sessions.get(sessionId)
      if (!history) return { sessionId, exists: false, messages: [] }

      const messages = history
        .filter(m => !(m instanceof SystemMessage))
        .map((m, i) => ({
          index: i + 1,
          role: m instanceof HumanMessage ? 'user' : 'assistant',
          content: m.content,
        }))

      return {
        sessionId,
        exists: true,
        turns: Math.floor(messages.length / 2),
        messages,
      }
    }

    // ── 清空会话 ──────────────────────────────────────────
  clearSession(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      return { sessionId, cleared: false, message: '会话不存在' }
    }
    this.sessions.set(sessionId, [this.systemMessage])
    return { sessionId, cleared: true, message: '会话已清空' }
  }

  // ── 所有会话列表 ──────────────────────────────────────
  listSessions() {
    const sessions = Array.from(this.sessions.entries()).map(([id, h]) => ({
      sessionId: id,
      turns: Math.floor((h.length - 1) / 2),
    }))
    return { total: sessions.length, sessions }
  }
}
```

### 8.3 memory.controller.ts
```javascript
// src/memory/memory.controller.ts

import { Controller, Post, Get, Delete, Body, Param, Res } from '@nestjs/common'
import { Response } from 'express'
import { MemoryService } from './memory.service'

@Controller('memory')
  export class MemoryController {
    constructor(private readonly memoryService: MemoryService) {}

    @Post('chat')
    chat(@Body() body: { sessionId: string; message: string }) {
      return this.memoryService.chat(body.sessionId, body.message)
    }

    @Post('chat-stream')
    chatStream(@Body() body: { sessionId: string; message: string }, @Res() res: Response) {
      return this.memoryService.chatStream(body.sessionId, body.message, res)
    }

    @Get('history/:sessionId')
    getHistory(@Param('sessionId') sessionId: string) {
      return this.memoryService.getHistory(sessionId)
    }

    @Delete('session/:sessionId')
    clearSession(@Param('sessionId') sessionId: string) {
      return this.memoryService.clearSession(sessionId)
    }

    @Get('sessions')
    listSessions() {
      return this.memoryService.listSessions()
    }
  }
```

---

## 九、RAG — 检索增强生成
### 9.1 概念说明
RAG 让模型基于你提供的私有知识回答，而不是靠训练时学到的知识乱猜。

```plain
流程：
  写入阶段（提前）：
    文档 → 分块 → 向量化 → 存入向量库

  查询阶段（实时）：
    用户问题 → 向量化 → 向量库检索 → 取 Top K 相关块
             → 拼入 Prompt → 模型基于资料回答

本文档用 MemoryVectorStore（内存向量库）
  优点：不需要启动 Chroma 服务
  缺点：重启应用数据清空
  生产环境：换成 Chroma 只改一行 import，其余代码完全一样
```

### 9.2 rag.service.ts
```javascript
// src/rag/rag.service.ts

import { Injectable } from '@nestjs/common'
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Document } from '@langchain/core/documents'
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { config } from '../config'

@Injectable()
  export class RagService {
    // 对话模型：RAG 场景用低温度，让回答更严格
    private llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: 0.1,
    })

    // 向量化模型：把文本转成数字向量（用于相似度比较）
    private embeddings = new OllamaEmbeddings({
      model: config.ollama.embedModel,   // 'mxbai-embed-large'
      baseUrl: config.ollama.baseUrl,
    })

    // 内存向量库（null 表示未初始化）
    private vectorStore: MemoryVectorStore | null = null
    private docCount = 0

    // ── 加载文档到向量库 ───────────────────────────────────
    async loadDocuments(
      documents: { id: string; content: string; source?: string }[],
    ) {
      // 文本分块器
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
        separators: ['\n\n', '\n', '。', '！', '？', ' ', ''],
      })

      const allDocs: Document[] = []

      for (const doc of documents) {
        const chunks = await splitter.createDocuments(
          [doc.content],
          [{ source: doc.source || doc.id, docId: doc.id }],
        )
        allDocs.push(...chunks)
      }

      // fromDocuments：批量向量化所有文档块，存入内存向量库
      // 内部调用 this.embeddings.embedDocuments(texts) 转成向量
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        allDocs,
        this.embeddings,
      )
      this.docCount = documents.length

      return {
        success: true,
        originalDocs: documents.length,
        totalChunks: allDocs.length,
        message: `加载 ${documents.length} 篇文档，共 ${allDocs.length} 个块`,
      }
    }

    // ── 纯向量检索（不过大模型，直接看检索结果）──────────
    async search(query: string, topK = 3) {
      if (!this.vectorStore) return { error: '请先调用 /rag/load 加载文档' }

      // similaritySearchWithScore 内部流程：
      // 1. 把 query 向量化（调用 embeddings.embedQuery）
      // 2. 和向量库里所有文档向量计算余弦相似度
      // 3. 按相似度排序，返回前 topK 个
      const results = await this.vectorStore.similaritySearchWithScore(query, topK)

      return {
        query,
        results: results.map(([doc, score]) => ({
          content: doc.pageContent,
          source: doc.metadata.source,
          score: parseFloat(score.toFixed(4)), // 越高越相关（0~1）
        })),
      }
    }

    // ── 完整 RAG 问答 ─────────────────────────────────────
    async query(question: string, topK = 3) {
      if (!this.vectorStore) return { error: '请先调用 /rag/load 加载文档' }

      // Step 1：检索相关文档块
      const retrieved = await this.vectorStore.similaritySearchWithScore(
        question, topK,
      )

      if (!retrieved.length) {
        return { question, answer: '知识库中没有找到相关内容', sources: [] }
      }

        // Step 2：把检索结果拼成 context 字符串
    // [1] 第一块内容\n\n[2] 第二块内容...
    // 编号方便模型在回答时引用："根据[1]..."
    const context = retrieved
      .map(([doc], i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n')

    // Step 3：RAG Prompt，严格限制模型只能用参考资料回答
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是知识库问答助手，严格基于参考资料回答。
规则：
1. 只根据参考资料内容回答，不能使用资料外的知识
2. 资料中没有相关信息，回答"知识库中暂无相关内容"
3. 回答简洁准确，使用中文

参考资料：
{context}`,
      ],
      ['human', '{question}'],
    ])

    // Step 4：调用模型生成回答
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const answer = await chain.invoke({ context, question })

    return {
      question,
      answer,
      sources: retrieved.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        score: parseFloat(score.toFixed(4)),
      })),
    }
  }

  getStatus() {
    return {
      loaded: !!this.vectorStore,
      docCount: this.docCount,
      message: this.vectorStore
        ? `已加载 ${this.docCount} 篇文档`
        : '知识库为空，请先加载文档',
    }
  }

  clearKnowledge() {
    this.vectorStore = null
    this.docCount = 0
    return { success: true, message: '知识库已清空' }
  }
}
```

### 9.3 rag.controller.ts
```javascript
// src/rag/rag.controller.ts

import { Controller, Post, Get, Delete, Body } from '@nestjs/common'
import { RagService } from './rag.service'

@Controller('rag')
  export class RagController {
    constructor(private readonly ragService: RagService) {}

    @Post('load')
    loadDocuments(
      @Body() body: { documents: { id: string; content: string; source?: string }[] },
    ) {
      return this.ragService.loadDocuments(body.documents)
    }

    @Post('search')
    search(@Body() body: { query: string; topK?: number }) {
      return this.ragService.search(body.query, body.topK)
    }

    @Post('query')
    query(@Body() body: { question: string; topK?: number }) {
      return this.ragService.query(body.question, body.topK)
    }

    @Get('status')
    getStatus() {
      return this.ragService.getStatus()
    }

    @Delete('clear')
    clearKnowledge() {
      return this.ragService.clearKnowledge()
    }
  }
```

---

## 十、Function Calling — 工具调用
### 10.1 概念说明
Function Calling 让模型把自然语言转成结构化的函数调用参数。

```markdown
用户说："查一下 iPhone 19 的库存"
模型输出（结构化）：
  { "tool": "check_inventory", "args": { "productName": "iPhone 18" } }
代码执行 check_inventory("iPhone 19")
把结果告诉模型，模型生成最终回答

和 Agent 的区别：
  Agent：多轮工具调用，模型自主决定调用几次
  Function Calling：通常单轮，专注于把自然语言转成结构化参数
```

### 10.2 function-calling.service.ts
```javascript
// src/function-calling/function-calling.service.ts

import { Injectable } from '@nestjs/common'
import { ChatOllama } from '@langchain/ollama'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'
import { config } from '../config'

@Injectable()
  export class FunctionCallingService {
  // temperature 设为 0，保证工具调用参数输出格式稳定
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0,
  })

  // ── 业务工具定义 ──────────────────────────────────────

  // 工具一：查询商品库存
  private checkInventoryTool = tool(
    async ({ productName }: { productName: string }) => {
      // 模拟数据库查询（实际项目可以注入 PrismaService 查真实数据库）
      const db: Record<string, { stock: number; price: number }> = {
  'iPhone 16': { stock: 50, price: 7999 },
  'MacBook Pro': { stock: 10, price: 15999 },
  'AirPods Pro': { stock: 200, price: 1799 },
}
const item = db[productName]
if (!item) return JSON.stringify({ found: false, message: `未找到：${productName}` })
return JSON.stringify({
  found: true,
  productName,
  stock: item.stock,
  price: item.price,
  status: item.stock > 0 ? '有货' : '缺货',
})
},
{
  name: 'check_inventory',
    description: '查询商品库存和价格',
    schema: z.object({
    productName: z.string().describe('商品名称，例如 iPhone 16'),
  }),
    },
    )

    // 工具二：创建订单
    private createOrderTool = tool(
    async ({ productName, quantity, customerName }: {
      productName: string; quantity: number; customerName: string
    }) => {
      const orderId = `ORD-${Date.now()}`
      return JSON.stringify({
        success: true,
        orderId,
        productName,
        quantity,
        customerName,
        createdAt: new Date().toLocaleString('zh-CN'),
      })
    },
    {
      name: 'create_order',
      description: '为客户创建购买订单',
      schema: z.object({
        productName: z.string().describe('商品名称'),
        quantity: z.number().describe('购买数量'),
        customerName: z.string().describe('客户姓名'),
      }),
    },
  )

  // 工具三：查询订单状态
  private checkOrderTool = tool(
    async ({ orderId }: { orderId: string }) => {
      const statuses = ['待支付', '已支付', '备货中', '已发货', '已完成']
      return JSON.stringify({
        orderId,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        updatedAt: new Date().toLocaleString('zh-CN'),
      })
    },
    {
      name: 'check_order',
      description: '查询订单状态',
      schema: z.object({
        orderId: z.string().describe('订单号，格式 ORD-XXXXX'),
      }),
    },
  )

  // ── Function Calling 核心逻辑 ─────────────────────────
  async runFunctionCalling(userMessage: string) {
    const tools = [this.checkInventoryTool, this.createOrderTool, this.checkOrderTool]
    const toolMap: Record<string, any> = {
      check_inventory: this.checkInventoryTool,
      create_order: this.createOrderTool,
      check_order: this.checkOrderTool,
    }

    const llmWithTools = this.llm.bindTools(tools)
    const messages: any[] = [new HumanMessage(userMessage)]
    const toolCallLog: any[] = []

    for (let round = 0; round < 3; round++) {
      const response = await llmWithTools.invoke(messages)
      messages.push(response)

      if (!response.tool_calls?.length) break

      for (const toolCall of response.tool_calls) {
        const toolFn = toolMap[toolCall.name]
        if (!toolFn) continue

        const result = await toolFn.invoke(toolCall.args)
        toolCallLog.push({
          tool: toolCall.name,
          args: toolCall.args,
          result: JSON.parse(result),
        })

        messages.push(new ToolMessage({ content: result, tool_call_id: toolCall.id }))
      }
    }

    const lastMsg = [...messages].reverse().find(m => m.constructor.name === 'AIMessage')

    return {
      userMessage,
      toolCalls: toolCallLog, // 调用了哪些工具、参数和结果
      finalAnswer: lastMsg?.content || '处理完成',
    }
  }
}
```

### 10.3 function-calling.controller.ts
```javascript
// src/function-calling/function-calling.controller.ts

import { Controller, Post, Body } from '@nestjs/common'
import { FunctionCallingService } from './function-calling.service'

@Controller('function-calling')
  export class FunctionCallingController {
    constructor(private readonly fcService: FunctionCallingService) {}

    @Post('run')
    run(@Body() body: { message: string }) {
      return this.fcService.runFunctionCalling(body.message)
    }
  }
```

---

## 十一、app.module.ts 追加注册
在原有 `app.module.ts` 基础上**追加** LangChain 相关模块，原有的 PrismaModule、UserModule、PostModule 保持不动：

```javascript
// src/app.module.ts

import { Module } from '@nestjs/common'

// ── 原有模块（不动）────────────────────────────────────
import { PrismaModule } from './prisma/prisma.module'
import { UserModule } from './user/user.module'
import { PostModule } from './post/post.module'

// ── 新增：LangChain 相关模块 ────────────────────────────
import { ModelsModule } from './models/models.module'
import { PromptsModule } from './prompts/prompts.module'
import { ChainsModule } from './chains/chains.module'
import { AgentsModule } from './agents/agents.module'
import { MemoryModule } from './memory/memory.module'
import { RagModule } from './rag/rag.module'
import { FunctionCallingModule } from './function-calling/function-calling.module'

@Module({
  imports: [
    // 原有模块
    PrismaModule,
    UserModule,
    PostModule,

    // LangChain 模块（新增）
    ModelsModule,
    PromptsModule,
    ChainsModule,
    AgentsModule,
    MemoryModule,
    RagModule,
    FunctionCallingModule,
  ],
})
  export class AppModule {}
```

---

## 十二、Apifox 完整测试
### 12.0 Apifox 基础配置
打开 Apifox，新建项目 → 新建请求，所有接口的基础 URL 是：

```plain
http://localhost:3000
```

每个接口的 **Body 类型统一选 JSON**（Headers 里 Content-Type 自动设为 application/json）。

SSE 流式接口需要在 Apifox 里把 **Response Type 设置为 Event Stream**，才能看到逐字输出效果。

---

### 12.1 Models 模块测试
#### 接口一：POST /models/chat — 基础问答
**配置：**

+ Method：POST
+ URL：`http://localhost:3000/models/chat`
+ Body（JSON）：

```json
{
  "message": "用一句话介绍 Vue3 的 Composition API"
}
```

**预期返回：**

```json
{
  "question": "用一句话介绍 Vue3 的 Composition API",
  "answer": "Vue3 的 Composition API 是一种基于函数的代码组织方式，通过 setup() 将相关逻辑聚合在一起，解决了 Options API 中逻辑分散的问题。",
  "usage": {
    "input_tokens": 28,
    "output_tokens": 56,
    "total_tokens": 84
  }
}
```

---

#### 接口二：POST /models/chat-system — 带 System Prompt
**配置：**

+ Method：POST
+ URL：`http://localhost:3000/models/chat-system`
+ Body（JSON）：

```json
{
  "system": "你是一个专业的前端开发导师，用简洁易懂的语言解释技术概念，每个解释不超过3句话",
  "message": "什么是 Pinia？"
}
```

**预期返回：**

```json
{
  "system": "你是一个专业的前端开发导师，用简洁易懂的语言解释技术概念，每个解释不超过3句话",
  "question": "什么是 Pinia？",
  "answer": "Pinia 是 Vue3 官方推荐的状态管理库，是 Vuex 的继任者。它提供了更简洁的 API，支持 TypeScript，并且天然兼容 Vue DevTools。相比 Vuex，Pinia 不需要 mutations，直接在 actions 里修改状态即可。"
}
```

**测试不同 System Prompt 的效果对比（建议录视频时演示）：**

```json
// System 改成"儿童教育专家"
{
  "system": "你是儿童教育专家，用10岁孩子能理解的方式解释所有概念",
  "message": "什么是 Pinia？"
}
```

---

#### 接口三：POST /models/chat-stream — SSE 流式输出
**配置：**

+ Method：POST
+ URL：`http://localhost:3000/models/chat-stream`
+ **Response Type：选 Event Stream（这步很关键）**
+ Body（JSON）：

```json
{
  "message": "写一首关于程序员深夜加班的短诗，要有意境"
}
```

**Apifox 里看到的效果（逐条 SSE 数据）：**

```plain
data: {"text":"夜"}
data: {"text":"深"}
data: {"text":"屏"}
data: {"text":"幕"}
data: {"text":"亮"}
...
data: [DONE]
```

这就是 ChatGPT 那种"打字机"效果的底层原理，每个 `data:` 是一个 chunk。

---

#### 接口四：POST /models/chat-parser — pipe 链调用
**配置：**

+ Method：POST
+ URL：`http://localhost:3000/models/chat-parser`
+ Body（JSON）：

```json
{
  "message": "Prisma ORM 是什么？"
}
```

**预期返回（注意：answer 直接是字符串，不是对象）：**

```json
{
  "question": "Prisma ORM 是什么？",
  "answer": "Prisma 是一个面向 Node.js 和 TypeScript 的现代 ORM，通过 Schema 定义数据库模型，自动生成类型安全的查询客户端，支持 PostgreSQL、MySQL、SQLite 等多种数据库。"
}
```

**对比说明（录视频时可以对比演示）：**

```plain
basicChat 返回：   { answer: AIMessage 对象 }  → response.content 才是字符串
chatWithParser 返回：{ answer: "字符串" }       → pipe(StringOutputParser) 直接提取
```

---

### 12.2 Prompts 模块测试
#### 接口一：POST /prompts/translate — 翻译
**测试用例一：中译英**

```json
{
  "text": "前端工程师需要掌握 Vue3、React 和 TypeScript，同时了解 Node.js 后端开发。",
  "targetLang": "英文"
}
```

**预期返回：**

```json
{
  "original": "前端工程师需要掌握 Vue3、React 和 TypeScript，同时了解 Node.js 后端开发。",
  "targetLang": "英文",
  "translated": "Frontend engineers need to master Vue3, React, and TypeScript, while also understanding Node.js backend development."
}
```

**测试用例二：中译日文**

```json
{
  "text": "今天天气很好，适合出去散步。",
  "targetLang": "日文"
}
```

**测试用例三：技术文档翻译（更有实战意义）**

```json
{
  "text": "Docker is a platform for developing, shipping, and running applications in containers.",
  "targetLang": "中文"
}
```

---

#### 接口二：POST /prompts/summarize — 文章总结
**测试用例：**

```json
{
  "text": "Vue3 是 Vue.js 的最新版本，于2020年9月正式发布。相比 Vue2，Vue3 带来了多项重大改进：首先是性能提升，渲染速度提高了约 1.3-2 倍，内存占用减少了约 50%；其次是引入了 Composition API，允许开发者将相关逻辑组织在一起，解决了 Options API 中逻辑分散的问题；第三是更好的 TypeScript 支持，Vue3 完全用 TypeScript 重写，提供了更好的类型推断；最后是新增了 Teleport、Fragments、Suspense 等新特性。",
  "maxWords": 50
}
```

**预期返回：**

```json
{
  "original": "Vue3 是 Vue.js 的最新版本...",
  "maxWords": 50,
  "summary": "Vue3 相比 Vue2 性能提升显著，引入了 Composition API 改善代码组织，完整支持 TypeScript，并新增了 Teleport 等实用特性。"
}
```

**验证总结质量：** 把 `maxWords` 改成 `20`，看看更极限的总结效果：

```json
{
  "text": "同样的长文章...",
  "maxWords": 20
}
```

---

#### 接口三：POST /prompts/classify — 情感分类（Few-Shot）
**连续发送多条测试，观察 Few-Shot 的效果：**

```json
{ "text": "这门课程太棒了，老师讲得非常清楚！" }
→ 预期：正面

{ "text": "内容太简单了，完全没学到东西，白花了钱" }
→ 预期：负面

{ "text": "课程质量一般，还行吧" }
→ 预期：中性

{ "text": "强烈推荐！物超所值，已经推荐给朋友了" }
→ 预期：正面

{ "text": "讲师语速太快，跟不上" }
→ 预期：负面
```

**预期返回格式：**

```json
{
  "text": "这门课程太棒了，老师讲得非常清楚！",
  "sentiment": "正面"
}
```

**Few-Shot 的价值**：不用解释什么是"正面"，只给 5 个例子，模型就学会了输出格式。这是提示词工程的核心技巧之一。

---

#### 接口四：POST /prompts/code-review — 代码审查
**测试用例一：有问题的 JavaScript 代码**

```json
{
  "language": "JavaScript",
  "code": "function getUserData(userId) {\n  var data = db.query('SELECT * FROM users WHERE id = ' + userId)\n  return data\n}"
}
```

**预期返回（模型应该发现 SQL 注入漏洞）：**

```json
{
  "language": "JavaScript",
  "code": "...",
  "review": "总体评分：3/10\n\n问题列表：\n1. 严重安全漏洞：使用字符串拼接构造 SQL 查询，存在 SQL 注入风险\n2. 使用 var 而非 const/let，不符合现代 JS 规范\n3. 缺少错误处理，数据库查询失败时会直接崩溃\n4. 函数是同步的，数据库操作应该是异步的\n\n改进后的代码：\n..."
}
```

**测试用例二：Vue3 组件代码**

```json
{
  "language": "Vue3",
  "code": "export default {\n  data() {\n    return {\n      userList: [],\n      loading: false\n    }\n  },\n  mounted() {\n    this.fetchUsers()\n  },\n  methods: {\n    async fetchUsers() {\n      this.loading = true\n      const res = await fetch('/api/users')\n      this.userList = await res.json()\n      this.loading = false\n    }\n  }\n}"
}
```

---

### 12.3 Chains 模块测试
#### 接口一：POST /chains/polish — 文章润色（多步链）
```json
{
  "article": "vue3很好用。它有composition api。这个api很方便。可以复用逻辑。比vue2好很多。推荐大家用。"
}
```

**预期返回（两步链的结果）：**

```json
{
  "original": "vue3很好用。它有composition api...",
  "polished": "Vue3 是一款优秀的前端框架，其核心特性 Composition API 大幅提升了代码的可维护性与复用性。相比 Vue2 的 Options API，Composition API 允许开发者将相关逻辑集中组织，避免了代码分散的问题。对于追求高效开发体验的前端工程师而言，Vue3 无疑是值得深入学习的优选方案。"
}
```

在终端里可以看到两步链的执行日志：第一步分析问题，第二步润色——这是 Chain 和单次调用最直观的区别。

---

#### 接口二：POST /chains/blog — 博客生成（顺序链）
⚠️ 这个接口需要多次调用大模型，响应时间较长（30~60 秒），等待时请勿重复发送。

```json
{
  "keywords": "NestJS 入门",
  "style": "技术教程"
}
```

**其他测试用例：**

```json
{ "keywords": "React Hooks 最佳实践", "style": "深度解析" }
{ "keywords": "程序员职业规划", "style": "经验分享" }
{ "keywords": "前端性能优化", "style": "实战指南" }
```

**预期返回结构：**

```json
{
  "keywords": "NestJS 入门",
  "style": "技术教程",
  "outline": "## NestJS 入门教程大纲\n1. NestJS 简介与核心概念\n2. 安装与项目初始化\n3. 模块、控制器、服务三层架构\n4. 接口开发与调试\n5. 数据持久化（Prisma）",
  "article": "# NestJS 入门教程\n\n## 一、NestJS 简介...",
  "seoTitles": "1. 10分钟上手 NestJS：从零到第一个接口\n2. NestJS 完全入门指南：企业级 Node.js 框架\n..."
}
```

---

#### 接口三：POST /chains/router — 客服路由（条件链）
**分别发送不同类型的问题，验证路由效果：**

```json
{ "question": "我的接口报 404 错误，怎么排查？" }
→ 预期 category：TECH，回答包含排查步骤

{ "question": "我买的课程不满意，可以退款吗？" }
→ 预期 category：REFUND，回答包含退款流程

{ "question": "建议网站增加暗黑模式" }
→ 预期 category：COMPLAINT，回答表示已记录建议

{ "question": "你们有没有优惠活动？" }
→ 预期 category：OTHER，通用回答
```

**预期返回格式：**

```json
{
  "question": "我的接口报 404 错误，怎么排查？",
  "category": "TECH",
  "answer": "您好！针对 404 错误，请按以下步骤排查：\n1. 检查路由路径是否正确...\n2. 确认控制器装饰器 @Controller 前缀是否匹配...\n3. ..."
}
```

**重点演示**：同一个问题发两次，体会 category 不同时 answer 风格的变化。

---

### 12.4 Agents 模块测试
本节使用**极速购电商 AI 客服**场景，4 个工具：查商品 / 创建订单 / 查订单 / 退款。 所有测试都看 `steps` 字段，它展示了 Agent 完整的"思考-行动"过程。

#### POST /agents/run — 智能客服 Agent
---

**测试一：单工具 — 查商品库存和价格**

```json
{
  "message": "iPhone 19 多少钱？有货吗？"
}
```

**预期返回：**

```json
{
  "userMessage": "iPhone 19 多少钱？有货吗？",
  "steps": [
    "🔧 [调用工具] check_product({"productName":"iPhone 18"})",
    "✅ [工具结果] 商品「iPhone 19」有货，单价 ¥7999，库存 50 件，分类：手机。",
    "💬 [最终回答] iPhone 19 目前有货，售价 ¥7999，库存充足，需要下单吗？"
  ],
  "totalRounds": 2,
  "answer": "iPhone 19 目前有货，售价 ¥7999，库存充足，需要下单吗？"
}
```

---

**测试二：多工具串联 — 查库存后自动下单（核心演示）**

```json
{
  "message": "我叫大伟，帮我买一台 MacBook Pro"
}
```

**预期返回（Agent 自主决定先查库存再下单，代码里没有写死这个顺序）：**

```json
{
  "userMessage": "我叫大伟，帮我买一台 MacBook Pro",
  "steps": [
    "🔧 [调用工具] check_product({"productName":"MacBook Pro"})",
    "✅ [工具结果] 商品「MacBook Pro」有货，单价 ¥15999，库存 8 件，分类：电脑。",
    "🔧 [调用工具] create_order({"productName":"MacBook Pro","quantity":1,"customerName":"张三"})",
    "✅ [工具结果] 订单创建成功！订单号：ORD-960000，客户：张三，总价 ¥15999。请在 30 分钟内完成支付。",
    "💬 [最终回答] 大伟您好！MacBook Pro 有货，已为您下单，订单号 ORD-960000，总价 ¥15999，请在 30 分钟内完成支付。"
  ],
  "totalRounds": 3,
  "answer": "大伟您好！MacBook Pro 有货，已为您下单，订单号 ORD-960000，总价 ¥15999，请在 30 分钟内完成支付。"
}
```

**录视频重点**：打开终端展示 `steps` 数组，逐条解读：

+ Agent 没有被告知"先查再买"，是它自己判断出需要先确认库存
+ `totalRounds: 3` 说明经历了 3 轮对话才完成任务
+ 这正是 Agent 和 Chain 的本质区别——Agent 自主决策，Chain 步骤写死

---

**测试三：Agent 主动询问缺失信息**

```json
{
  "message": "我要买两台 AirPods Pro"
}
```

用户没有说姓名，Agent 应该先查库存，再主动询问：

```json
{
  "steps": [
    "🔧 [调用工具] check_product({"productName":"AirPods Pro"})",
    "✅ [工具结果] 商品「AirPods Pro」有货，单价 ¥1799，库存 200 件，分类：耳机。",
    "💬 [最终回答] AirPods Pro 有货，两台共 ¥3598。请问您的姓名是？方便为您创建订单。"
  ],
  "answer": "AirPods Pro 有货，两台共 ¥3598。请问您的姓名是？方便为您创建订单。"
}
```

Agent 知道下单需要客户姓名（System Prompt 里写了这条规则），所以主动询问，而不是强行下单报错。

---

**测试四：查询订单状态**

```json
{
  "message": "帮我查一下订单 ORD-960000 的状态"
}
```

**预期返回：**

```json
{
  "steps": [
    "🔧 [调用工具] check_order({"orderId":"ORD-960000"})",
    "✅ [工具结果] 订单 ORD-960000 当前状态：已发货运输中，预计明天送达。",
    "💬 [最终回答] 您的订单 ORD-960000 已发货，预计明天送达，请注意查收！"
  ],
  "answer": "您的订单 ORD-960000 已发货，预计明天送达，请注意查收！"
}
```

---

**测试五：申请退款**

```json
{
  "message": "我的订单 ORD-960000 质量有问题，我要退款"
}
```

**预期返回：**

```json
{
  "steps": [
    "🔧 [调用工具] apply_refund({"orderId":"ORD-960000","reason":"质量问题"})",
    "✅ [工具结果] 退款申请已提交！退款单号：REF-123456，预计 1-3 个工作日内退回原支付渠道。",
    "💬 [最终回答] 非常抱歉给您带来不便！退款申请已受理，退款单号 REF-123456，1-3 个工作日内退回，请注意查收。"
  ],
  "answer": "非常抱歉给您带来不便！退款申请已受理，退款单号 REF-123456，1-3 个工作日内退回，请注意查收。"
}
```

---

**测试六：复杂意图 — 一句话买两件商品（进阶演示）**

```json
{
  "message": "我是李四，iPhone 16 和 AirPods Pro 各买一个"
}
```

Agent 需要依次查两个商品库存，再分别下单，`totalRounds` 会比较多：

```json
{
  "steps": [
    "🔧 [调用工具] check_product({"productName":"iPhone 16"})",
    "✅ [工具结果] 商品「iPhone 16」有货，单价 ¥7999，库存 50 件。",
    "🔧 [调用工具] check_product({"productName":"AirPods Pro"})",
    "✅ [工具结果] 商品「AirPods Pro」有货，单价 ¥1799，库存 200 件。",
    "🔧 [调用工具] create_order({"productName":"iPhone 16","quantity":1,"customerName":"李四"})",
    "✅ [工具结果] 订单创建成功！订单号：ORD-111111，总价 ¥7999。",
    "🔧 [调用工具] create_order({"productName":"AirPods Pro","quantity":1,"customerName":"李四"})",
    "✅ [工具结果] 订单创建成功！订单号：ORD-222222，总价 ¥1799。",
    "💬 [最终回答] 李四您好！已为您创建两个订单：iPhone 16（ORD-111111，¥7999）和 AirPods Pro（ORD-222222，¥1799），合计 ¥9798，请在 30 分钟内完成支付。"
  ],
  "totalRounds": 5,
  "answer": "..."
}
```

**这个测试展示了 Agent 最强大的地方**：一句自然语言，Agent 自动拆解成 4 次工具调用，全程无需人工干预。

---

**测试七：查询不存在的商品**

```json
{
  "message": "三星 Galaxy S25 有货吗？"
}
```

**预期返回：**

```json
{
  "steps": [
    "🔧 [调用工具] check_product({"productName":"三星 Galaxy S25"})",
    "✅ [工具结果] 商品「三星 Galaxy S25」不存在，请检查商品名称是否正确。",
    "💬 [最终回答] 抱歉，我们平台目前没有三星 Galaxy S25 这款商品，如需查询其他商品请告知。"
  ],
  "answer": "抱歉，我们平台目前没有三星 Galaxy S25 这款商品，如需查询其他商品请告知。"
}
```

---

### 12.5 Memory 模块测试
**Memory 测试的关键**：同一个 `sessionId` 连续发送多条消息，验证模型是否记住了上文。不同 `sessionId` 的会话互相独立。

#### 场景一：验证基础记忆能力
**第一轮（POST /memory/chat）：**

```json
{
  "sessionId": "dawei-001",
  "message": "我叫大伟，是一名有 5 年经验的前端开发者，主要做 Vue3 项目"
}
```

**预期返回：**

```json
{
  "sessionId": "dawei-001",
  "message": "我叫大伟，是一名有 5 年经验的前端开发者...",
  "reply": "你好，大伟！很高兴认识你。5 年的前端经验很丰富，Vue3 也是当前非常热门的框架。有什么我可以帮助你的吗？",
  "turns": 1
}
```

**第二轮（同一个 sessionId）：**

```json
{
  "sessionId": "dawei-001",
  "message": "我叫什么名字？做什么工作的？有几年经验？"
}
```

**预期返回（模型应该记住第一轮说的信息）：**

```json
{
  "sessionId": "dawei-001",
  "reply": "你叫大伟，是一名前端开发者，有 5 年的工作经验，主要专注于 Vue3 项目开发。",
  "turns": 2
}
```

**第三轮（基于上下文推理）：**

```json
{
  "sessionId": "dawei-001",
  "message": "根据我的情况，推荐我接下来应该学哪些技术提升竞争力？"
}
```

模型应该基于"前端开发者、Vue3、5年经验"给出针对性建议，而不是通用回答。

---

#### 场景二：同时开启两个独立会话
**会话 A — 第一条消息：**

```json
{
  "sessionId": "session-A",
  "message": "我是前端开发者小明，喜欢 React"
}
```

**会话 B — 第一条消息：**

```json
{
  "sessionId": "session-B",
  "message": "我是后端开发者小红，用 Java Spring Boot"
}
```

**会话 A — 第二条消息（问身份）：**

```json
{
  "sessionId": "session-A",
  "message": "我是谁？用什么框架？"
}
```

**预期：回答是"小明，React"，不会把小红的信息混进来。**

**会话 B — 第二条消息：**

```json
{
  "sessionId": "session-B",
  "message": "我是谁？"
}
```

**预期：回答是"小红，Java Spring Boot 后端开发者"。**

---

#### 查看会话历史（GET /memory/history/:sessionId）
```plain
GET http://localhost:3000/memory/history/dawei-001
```

**预期返回：**

```json
{
  "sessionId": "dawei-001",
  "exists": true,
  "turns": 3,
  "messages": [
    { "index": 1, "role": "user", "content": "我叫大伟，是一名有 5 年经验的前端开发者..." },
    { "index": 2, "role": "assistant", "content": "你好，大伟！..." },
    { "index": 3, "role": "user", "content": "我叫什么名字？..." },
    { "index": 4, "role": "assistant", "content": "你叫大伟..." },
    { "index": 5, "role": "user", "content": "根据我的情况..." },
    { "index": 6, "role": "assistant", "content": "建议你..." }
  ]
}
```

---

#### 清空会话后验证记忆消失（DELETE /memory/session/:sessionId）
```plain
DELETE http://localhost:3000/memory/session/dawei-001
```

**返回：**

```json
{
  "sessionId": "dawei-001",
  "cleared": true,
  "message": "会话已清空"
}
```

**清空后再问身份（验证记忆真的消失了）：**

```json
{
  "sessionId": "dawei-001",
  "message": "我叫什么名字？"
}
```

**预期：模型回答"我不知道你的名字，因为你还没有告诉我"——记忆成功清空。**

---

#### SSE 流式多轮对话（POST /memory/chat-stream）
**Apifox 里 Response Type 选 Event Stream，然后发送：**

```json
{
  "sessionId": "stream-001",
  "message": "帮我写一首关于程序员的七言绝句"
}
```

**看到逐字 SSE 流后，继续追问（同一 sessionId）：**

```json
{
  "sessionId": "stream-001",
  "message": "把这首诗翻译成英文"
}
```

流式版本的记忆功能同样有效，模型知道"这首诗"指的是刚才写的那首。

---

#### 查看所有会话（GET /memory/sessions）
```plain
GET http://localhost:3000/memory/sessions
```

**预期返回：**

```json
{
  "total": 4,
  "sessions": [
    { "sessionId": "dawei-001", "turns": 0 },
    { "sessionId": "session-A", "turns": 2 },
    { "sessionId": "session-B", "turns": 2 },
    { "sessionId": "stream-001", "turns": 2 }
  ]
}
```

---

### 12.6 RAG 模块测试
**RAG 测试必须按顺序来**：先加载文档，再检索，再问答。

#### 第一步：POST /rag/load — 加载知识库
```json
{
  "documents": [
    {
      "id": "doc-001",
      "source": "公司员工手册",
      "content": "员工请假流程：1. 提前3天在OA系统提交申请。2. 直属领导在24小时内审批。3. HR备案留存。病假需在返岗后3天内提交医院证明。年假每年15天，入职满一年后生效，当年未用完可顺延至次年3月底。"
    },
    {
      "id": "doc-002",
      "source": "技术知识库",
      "content": "Vue3 的 Composition API 是通过 setup() 函数或 <script setup> 语法糖实现的。ref() 用于基础类型的响应式数据，reactive() 用于对象类型。computed() 创建计算属性，watch() 和 watchEffect() 用于监听数据变化。provide/inject 实现跨组件通信，不需要 Vuex。"
    },
    {
      "id": "doc-003",
      "source": "产品使用手册",
      "content": "本平台支持三种付款方式：支付宝、微信支付、银行卡（支持 Visa/MasterCard/银联）。退款政策：课程购买后7天内可申请全额退款，7-30天内可申请50%退款，30天后不支持退款。退款审核时间1-3个工作日，退款到账时间根据支付方式不同为1-7个工作日。客服电话：400-123-4567，工作时间：周一至周五 9:00-18:00。"
    },
    {
      "id": "doc-004",
      "source": "NestJS 技术文档",
      "content": "NestJS 使用模块化架构，每个功能封装为 Module。Module 包含 Controller（处理路由）、Service（业务逻辑）、Provider（依赖注入）。@Global() 装饰器使模块全局可用。使用 @Injectable() 声明可注入服务，通过构造函数注入依赖。路由装饰器：@Get()、@Post()、@Put()、@Delete()、@Patch()。"
    }
  ]
}
```

**预期返回：**

```json
{
  "success": true,
  "originalDocs": 4,
  "totalChunks": 8,
  "message": "加载 4 篇文档，共 8 个块"
}
```

---

#### 第二步：GET /rag/status — 查看状态
```plain
GET http://localhost:3000/rag/status
```

**预期返回：**

```json
{
  "loaded": true,
  "docCount": 4,
  "message": "已加载 4 篇文档"
}
```

---

#### 第三步：POST /rag/search — 纯向量检索（看检索效果）
```json
{
  "query": "请假需要提前几天",
  "topK": 2
}
```

**预期返回（看 score 分数，越高越相关）：**

```json
{
  "query": "请假需要提前几天",
  "results": [
    {
      "content": "员工请假流程：1. 提前3天在OA系统提交申请...",
      "source": "公司员工手册",
      "score": 0.8923
    },
    {
      "content": "本平台支持三种付款方式...",
      "source": "产品使用手册",
      "score": 0.3241
    }
  ]
}
```

**重点**：第一条 score 0.89 很高，第二条 0.32 很低——这说明向量检索准确地找到了相关文档，而不是随机返回。

---

#### 第四步：POST /rag/query — 完整 RAG 问答
**测试一：知识库里有答案的问题**

```json
{
  "question": "请假需要提前几天申请？年假有多少天？",
  "topK": 3
}
```

**预期返回：**

```json
{
  "question": "请假需要提前几天申请？年假有多少天？",
  "answer": "根据公司员工手册，请假需要提前3天在OA系统提交申请，需要直属领导在24小时内审批。年假每年有15天，入职满一年后生效，当年未用完可以顺延至次年3月底。",
  "sources": [
    {
      "content": "员工请假流程：1. 提前3天在OA系统提交申请...",
      "source": "公司员工手册",
      "score": 0.8923
    }
  ]
}
```

**测试二：技术知识问答**

```json
{
  "question": "Vue3 里 ref 和 reactive 有什么区别？"
}
```

**测试三：退款政策查询**

```json
{
  "question": "我购买课程15天了，还能退款吗？"
}
```

**预期：模型根据退款政策（7天全额，7-30天50%），回答"可以申请50%退款"。**

**测试四：知识库没有的问题（关键演示）**

```json
{
  "question": "公司的股价是多少？"
}
```

**预期返回：**

```json
{
  "question": "公司的股价是多少？",
  "answer": "知识库中暂无相关内容",
  "sources": []
}
```

**这是 RAG 最重要的演示**：模型没有乱编，而是诚实地说"没有相关内容"——这就是 RAG 解决幻觉问题的价值所在。

**测试五：跨文档综合问答**

```json
{
  "question": "NestJS 的 @Injectable() 是什么？Vue3 的 ref() 怎么用？",
  "topK": 4
}
```

这条会同时检索 NestJS 文档和 Vue3 文档，模型综合两份资料回答。

---

#### 第五步：DELETE /rag/clear — 清空知识库
```plain
DELETE http://localhost:3000/rag/clear
```

**清空后再问问题，验证报错：**

```json
{
  "question": "请假要提前几天？"
}
```

**预期返回：**

```json
{
  "error": "请先调用 /rag/load 加载文档"
}
```

---

### 12.7 Function Calling 模块测试
#### POST /function-calling/run — 工具调用
**测试一：查询商品库存**

```json
{
  "message": "iPhone 16 还有货吗？多少钱？"
}
```

**预期返回：**

```json
{
  "userMessage": "iPhone 16 还有货吗？多少钱？",
  "toolCalls": [
    {
      "tool": "check_inventory",
      "args": { "productName": "iPhone 16" },
      "result": {
        "found": true,
        "productName": "iPhone 16",
        "stock": 50,
        "price": 7999,
        "status": "有货"
      }
    }
  ],
  "finalAnswer": "iPhone 16 目前有货，库存50台，售价 ¥7999。"
}
```

---

**测试二：购买商品（先查库存，再创建订单）**

```json
{
  "message": "我叫大伟，我要购买 2 台 MacBook Pro"
}
```

**预期 toolCalls（两步工具调用）：**

```json
{
  "toolCalls": [
    {
      "tool": "check_inventory",
      "args": { "productName": "MacBook Pro" },
      "result": { "found": true, "stock": 10, "price": 15999, "status": "有货" }
    },
    {
      "tool": "create_order",
      "args": { "productName": "MacBook Pro", "quantity": 2, "customerName": "大伟" },
      "result": {
        "success": true,
        "orderId": "ORD-1732960000000",
        "productName": "MacBook Pro",
        "quantity": 2,
        "customerName": "大伟",
        "createdAt": "2025/11/30 14:30:00"
      }
    }
  ],
  "finalAnswer": "大伟您好！MacBook Pro 库存充足（10台），已为您创建订单 ORD-1732960000000，共2台，总价 ¥31998。"
}
```

---

**测试三：查询订单状态**

```json
{
  "message": "帮我查一下订单 ORD-1732960000000 的状态"
}
```

**预期 toolCalls：**

```json
{
  "toolCalls": [
    {
      "tool": "check_order",
      "args": { "orderId": "ORD-1732960000000" },
      "result": {
        "orderId": "ORD-1732960000000",
        "status": "备货中",
        "updatedAt": "2025/11/30 14:35:00"
      }
    }
  ],
  "finalAnswer": "您的订单 ORD-1732960000000 目前状态为「备货中」，更新时间为2025年11月30日14:35。"
}
```

---

**测试四：查询不存在的商品**

```json
{
  "message": "三星 Galaxy S25 有货吗？"
}
```

**预期 result：**

```json
{
  "toolCalls": [
    {
      "tool": "check_inventory",
      "args": { "productName": "三星 Galaxy S25" },
      "result": { "found": false, "message": "未找到：三星 Galaxy S25" }
    }
  ],
  "finalAnswer": "抱歉，我们目前没有三星 Galaxy S25 的库存信息，该商品可能不在我们的销售范围内。"
}
```

---

**测试五：复合查询（一句话查多个商品）**

```json
{
  "message": "分别告诉我 iPhone 16 和 AirPods Pro 的价格和库存"
}
```

---

### 12.8 各模块测试顺序建议（录视频用）
| 顺序 | 模块 | 演示重点 |
| --- | --- | --- |
| 1 | Models/chat | 最简单，验证 Ollama 连通 |
| 2 | Models/chat-stream | SSE 流式，看"打字机"效果 |
| 3 | Prompts/translate | 模板变量，同一模板不同输出 |
| 4 | Prompts/classify | Few-Shot，不用解释就学会分类 |
| 5 | Chains/router | 条件链，不同问题路由不同答案 |
| 6 | Agents/run | 多工具，看 steps 里的思考过程 |
| 7 | Memory/chat | 连发 3 轮，证明模型记住了上文 |
| 8 | RAG/load → query | 问知识库有的 + 没有的，对比效果 |
| 9 | FunctionCalling/run | 购物场景，看 toolCalls 完整链路 |


---

## 附：依赖库速查表
| 包名 | 版本 | 作用 | 主要导出 |
| --- | --- | --- | --- |
| `@langchain/ollama` | 最新 | Ollama 模型对接 | `ChatOllama`<br/>`OllamaEmbeddings` |
| `@langchain/core` | 最新 | 基础类型和接口 | `HumanMessage`<br/>`AIMessage`<br/>`SystemMessage`<br/>`ToolMessage`<br/>`ChatPromptTemplate`<br/>`PromptTemplate`<br/>`StringOutputParser`<br/>`RunnableSequence`<br/>`tool()` |
| `@langchain/community` | 最新 | 社区集成（Chroma 等） | `Chroma`<br/>（向量库生产用） |
| `@langchain/textsplitters` | 最新 | 文档分块 | `RecursiveCharacterTextSplitter` |
| `langchain` | 最新 | LangChain 主包 | `MemoryVectorStore`<br/>（内存向量库） |
| `zod` | 最新 | 运行时类型校验 | `z.object()`<br/>`z.string()`<br/>`z.number()` |


---

## 附：Git 分支管理建议
```bash
# 在 feature/langchain 分支开发完后

# 查看本分支的改动
git status
git diff

# 提交代码
git add .
git commit -m "feat: 集成 LangChain 七大模块（Models/Prompts/Chains/Agents/Memory/RAG/FunctionCalling）"

# 如果想回到原来的主分支（用户模块 + 文章模块）
git checkout main

# 如果想切回 LangChain 分支继续开发
git checkout feature/langchain

# 两个分支互不影响，学员可以分别演示
```
