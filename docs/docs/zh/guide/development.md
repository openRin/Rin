# 本地开发指南

本文档介绍如何在本地开发和调试 Rin 项目。

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/openRin/Rin.git
cd Rin
```

### 2. 安装依赖

```bash
bun install
```

### 3. 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env.local

# 编辑配置文件，填入你的实际配置
vim .env.local  # 或使用其他编辑器
```

### 4. 启动开发服务器

```bash
bun run dev
```

这将自动完成以下操作：
- ✅ 生成 `wrangler.toml` 配置文件
- ✅ 生成 `.dev.vars` 敏感信息文件
- ✅ 运行数据库迁移
- ✅ 启动开发服务器（端口 11498 - 前后端同源）

访问 http://localhost:11498 即可开始开发！

## 环境变量配置

所有配置都集中在 `.env.local` 文件中：

### 前端配置

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `API_URL` | 是 | 后端 API 地址 | `http://localhost:11498` |
| `NAME` | 是 | 网站名称 | `My Blog` |
| `AVATAR` | 是 | 头像地址 | `https://...` |
| `DESCRIPTION` | 否 | 网站描述 | `A blog` |
| `PAGE_SIZE` | 否 | 分页大小 | `5` |
| `RSS_ENABLE` | 否 | 启用 RSS | `false` |

### 后端配置

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `FRONTEND_URL` | 是 | 前端地址 | `http://localhost:5173` |
| `S3_ENDPOINT` | 是 | S3/R2 端点 | `https://...r2.cloudflarestorage.com` |
| `S3_BUCKET` | 是 | 存储桶名称 | `images` |
| `S3_REGION` | 否 | 区域 | `auto` |
| `S3_FOLDER` | 否 | 图片存储路径 | `images/` |
| `WEBHOOK_URL` | 否 | 通知 Webhook | `https://...` |

### 敏感配置（必须）

| 变量名 | 说明 |
|--------|------|
| `RIN_GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `RIN_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `JWT_SECRET` | JWT 签名密钥 |
| `S3_ACCESS_KEY_ID` | S3 Access Key |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Key |

## 常用命令

```bash
# 启动完整开发环境（推荐）
bun run dev

# 仅启动前端
bun run dev:client

# 仅启动后端
bun run dev:server

# 运行数据库迁移
bun run db:migrate

# 生成数据库迁移文件
bun run db:generate

# 重新生成配置文件
bun run dev:setup

# 构建项目
bun run build

# 清理生成的文件
bun run clean

# 运行类型检查
bun run check

# 格式化代码
bun run format:write
bun run format:check

# 运行测试
bun run test              # 运行所有测试
bun run test:server       # 仅运行服务端测试
 bun run test:coverage     # 运行测试并生成覆盖率报告
```

## 开发工作流

### 首次设置

1. Fork 项目仓库
2. 克隆到本地
3. 安装依赖：`bun install`
4. 配置 `.env.local`
5. 运行 `bun run dev`

### 日常开发

1. 修改代码
2. 前端自动热更新，后端修改后自动重启
3. 测试功能
4. 提交代码

### 数据库变更

1. 修改 `server/src/db/schema.ts`
2. 运行 `bun run db:generate` 生成迁移文件
3. 运行 `bun run db:migrate` 应用迁移

## 测试

项目为客户端和服务端使用了不同的测试框架：

### 客户端测试 (Vitest)

客户端测试使用 Vitest 配合 jsdom 环境进行 React 组件测试。

```bash
# 运行客户端测试
cd client && bun run test

# 监视模式
cd client && bun run test:watch

# 生成覆盖率报告
cd client && bun run test:coverage
```

测试文件位置：`client/src/**/__tests__/*.test.ts`

### 服务端测试 (Bun)

服务端测试使用 Bun 原生测试运行器和内存 SQLite 数据库。

```bash
# 运行服务端测试
cd server && bun run test

# 生成覆盖率报告
cd server && bun run test:coverage
```

测试文件位置：
- 单元测试：`server/src/**/__tests__/*.test.ts`
- 集成测试：`server/tests/integration/`
- 安全测试：`server/tests/security/`

### 添加新测试

添加新功能时，请包含相应的测试：

1. **客户端**：在 `client/src/**/__tests__/*.test.ts` 添加测试
2. **服务端**：在 `server/src/**/__tests__/*.test.ts` 或 `server/tests/` 添加测试

## API 架构

### 自定义 API 客户端

项目使用自定义 HTTP 客户端替代 Eden，实现类型安全的 API 通信：

- **位置**：`client/src/api/client.ts`
- **特性**：类型安全请求、错误处理、认证令牌管理
- **使用方式**：所有 API 调用都通过类型化客户端进行

### 共享类型 (@rin/api)

`@rin/api` 包为客户端和服务端提供共享的 TypeScript 类型：

- **位置**：`packages/api/`
- **用途**：API 契约的端到端类型安全
- **使用方式**：在客户端和服务端代码中从 `@rin/api` 导入类型

添加新 API 端点时：
1. 在 `packages/api/src/types.ts` 中定义类型
2. 在 `server/src/services/` 中实现服务端处理器
3. 客户端通过共享类型自动获得类型安全

## 故障排除

### 端口被占用

如果端口 5173 或 11498 被占用，可以修改 `.env.local` 中的配置：

```bash
# 修改前端端口（需要在 vite.config.ts 中配置）
# 修改后端端口
bun run dev:server -- --port 11499
```

### 数据库迁移失败

```bash
# 清理本地数据库并重新迁移
rm -rf .wrangler/state
bun run db:migrate
```

### 配置文件未生成

```bash
# 手动运行配置生成
bun run dev:setup
```

### GitHub OAuth 配置

本地开发时需要配置 GitHub OAuth：

1. 访问 https://github.com/settings/developers
2. 创建新的 OAuth App
3. Authorization callback URL 填写：`http://localhost:11498/user/github/callback`
4. 将 Client ID 和 Client Secret 填入 `.env.local`

## 项目结构

```
.
├── client/                 # 前端代码 (React + Vite)
│   ├── src/
│   │   ├── page/          # 页面组件
│   │   ├── api/           # API 客户端
│   │   ├── components/    # React 组件
│   │   └── utils/         # 工具函数
│   └── package.json
├── server/                 # 后端代码 (Cloudflare Workers)
│   ├── src/
│   │   ├── services/      # 业务服务
│   │   ├── db/            # 数据库表结构
│   │   ├── core/          # 路由和核心类型
│   │   └── utils/         # 工具函数
│   ├── tests/             # 测试文件
│   └── package.json
├── packages/               # 共享包
│   └── api/                # @rin/api - 共享 API 类型
├── cli/                    # Rin CLI 工具
│   └── bin/
│       └── rin.ts          # CLI 入口文件
├── scripts/                # 开发脚本
│   ├── dev.ts             # 开发服务器
│   ├── setup-dev.ts       # 配置生成
│   └── db-migrate-local.ts    # 数据库迁移
├── docs/                   # 文档
├── .env.example            # 环境变量示例
├── .env.local              # 本地配置（不提交到 Git）
└── package.json
```

## 生产部署

请参考 [部署指南](./deploy.mdx) 了解生产环境部署流程。

## 获取帮助

- 📖 完整文档：https://docs.openrin.org
- 💬 Discord：https://discord.gg/JWbSTHvAPN
- 🐛 提交 Issue：https://github.com/openRin/Rin/issues
