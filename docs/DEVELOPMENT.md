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
- ✅ 生成 `client/.env` 前端环境变量
- ✅ 生成 `.dev.vars` 敏感信息文件
- ✅ 运行数据库迁移
- ✅ 启动后端服务（端口 11498）
- ✅ 启动前端服务（端口 5173）

访问 http://localhost:5173 即可开始开发！

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
bun run typecheck

# 格式化代码
bun run format:write
bun run format:check
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
├── client/                 # 前端代码
│   ├── src/
│   │   ├── page/          # 页面组件
│   │   ├── state/         # 状态管理
│   │   └── utils/         # 工具函数
│   └── package.json
├── server/                 # 后端代码
│   ├── src/
│   │   ├── services/      # 业务服务
│   │   ├── db/            # 数据库
│   │   └── utils/         # 工具函数
│   └── package.json
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

请参考 [DEPLOY.md](./DEPLOY.md) 了解生产环境部署流程。

## 获取帮助

- 📖 完整文档：https://docs.openrin.org
- 💬 Discord：https://discord.gg/JWbSTHvAPN
- 🐛 提交 Issue：https://github.com/openRin/Rin/issues
