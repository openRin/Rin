# 环境变量配置指南

Rin 部署需要配置两类环境变量：**Variables（明文变量）**和**Secrets（加密变量）**。

## 快速区分

| 类型 | 存储方式 | 用途 | 示例 |
|------|---------|------|------|
| **Variables** | 明文存储在 `wrangler.toml` | 配置参数、开关选项 | 存储桶名称、缓存模式 |
| **Secrets** | 加密存储在 Cloudflare | 敏感凭证、密钥 | API 密钥、密码、Token |

---

## Variables（明文变量）

这些变量在 `wrangler.toml` 中明文存储，用于配置功能开关和基本参数。

### 站点配置

| 变量名 | 必填 | 描述 | 默认值 | 配置键名 |
|--------|------|------|--------|----------|
| `NAME` | 否 | 网站名称 | Rin | `site.name` |
| `DESCRIPTION` | 否 | 网站描述 | A lightweight personal blogging system | `site.description` |
| `AVATAR` | 否 | 网站头像 URL | - | `site.avatar` |
| `PAGE_SIZE` | 否 | 默认分页大小 | 5 | `site.page_size` |
| `RSS_ENABLE` | 否 | 启用 RSS 链接 | false | `rss` |

:::tip
站点配置可在部署后通过**设置页面**修改，环境变量仅作为初始值。
:::

### 存储配置

| 变量名 | 必填 | 描述 | 默认值 | 示例 |
|--------|------|------|--------|------|
| `S3_FOLDER` | 是 | 图片存储路径 | images/ | `images/` |
| `S3_CACHE_FOLDER` | 否 | 缓存文件路径 | cache/ | `cache/` |
| `S3_BUCKET` | 是 | S3 存储桶名称 | - | `my-bucket` |
| `S3_REGION` | 是 | S3 区域（R2 填 auto） | - | `auto` |
| `S3_ENDPOINT` | 是 | S3 接入点地址 | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | 否 | 对外访问地址 | 同 S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | 否 | 强制路径样式 | false | `false` |

### 功能开关

| 变量名 | 必填 | 描述 | 默认值 | 推荐值 |
|--------|------|------|--------|--------|
| `CACHE_STORAGE_MODE` | 否 | 缓存模式：s3/database | s3 | **database** |
| `WEBHOOK_URL` | 否 | 评论通知 Webhook | - | - |
| `RSS_TITLE` | 否 | RSS 标题 | - | - |
| `RSS_DESCRIPTION` | 否 | RSS 描述 | - | - |

:::tip 新用户推荐
建议将 `CACHE_STORAGE_MODE` 设为 `database`，无需额外配置 S3 缓存即可使用，降低部署复杂度。
:::

---

## Secrets（加密变量）

这些敏感信息必须作为 **Cloudflare Workers Secrets** 配置，部署时通过命令行输入或提前设置。

### 认证相关（至少配置一种）

| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `RIN_GITHUB_CLIENT_ID` | GitHub OAuth 客户端 ID | GitHub OAuth App 设置 |
| `RIN_GITHUB_CLIENT_SECRET` | GitHub OAuth 客户端密钥 | GitHub OAuth App 设置 |
| `ADMIN_USERNAME` | 账号密码登录用户名 | 自行设定 |
| `ADMIN_PASSWORD` | 账号密码登录密码 | 自行设定 |
| `JWT_SECRET` | JWT 签名密钥（任意随机字符串） | 自行生成 |

:::warning 认证要求
必须配置 **GitHub OAuth** 或 **账号密码** 其中一种登录方式，否则无法登录后台。
:::

### S3 存储凭证

| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `S3_ACCESS_KEY_ID` | S3 访问密钥 ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | S3 访问密钥 | R2 API Token |

### Cloudflare 部署凭证

| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 访问令牌 | Cloudflare 面板 → 我的个人资料 → API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | Cloudflare 面板右侧 sidebar |

---

## GitHub Actions 变量配置

使用 GitHub Actions 自动部署时，需在 Repository 设置中配置以下变量：

### Repository Variables（Settings → Secrets and variables → Variables）

```
NAME              # 网站名称
DESCRIPTION       # 网站描述
AVATAR            # 网站头像
PAGE_SIZE         # 分页大小
RSS_ENABLE        # 是否启用 RSS
CACHE_STORAGE_MODE # 缓存模式（推荐 database）
R2_BUCKET_NAME    # 可选：设置后部署会从该 bucket 推导 S3_*；未设置时不会自动选择任何 R2 bucket
WORKER_NAME       # Worker 名称（可选）
DB_NAME           # D1 数据库名称（可选）
```

### Repository Secrets（Settings → Secrets and variables → Secrets）

```
CLOUDFLARE_API_TOKEN      # Cloudflare API 令牌
CLOUDFLARE_ACCOUNT_ID     # Cloudflare 账户 ID
S3_ENDPOINT               # S3/R2 接入点
S3_ACCESS_HOST            # S3/R2 访问域名
S3_BUCKET                 # S3 存储桶名称
S3_ACCESS_KEY_ID          # S3 访问密钥 ID
S3_SECRET_ACCESS_KEY      # S3 访问密钥
RIN_GITHUB_CLIENT_ID      # GitHub OAuth ID（可选）
RIN_GITHUB_CLIENT_SECRET  # GitHub OAuth Secret（可选）
ADMIN_USERNAME            # 管理员用户名（可选）
ADMIN_PASSWORD            # 管理员密码（可选）
JWT_SECRET                # JWT 密钥
```

---

## 本地开发环境变量

本地开发使用 `.env` 文件，参考 `.env.example`：

```bash
# 站点配置
NAME="My Blog"
DESCRIPTION="A personal blog"

# S3 存储（使用 R2 或 MinIO）
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx

# 认证（GitHub 或账号密码）
RIN_GITHUB_CLIENT_ID=xxx
RIN_GITHUB_CLIENT_SECRET=xxx
# 或
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# 其他
JWT_SECRET=random_secret_key
CACHE_STORAGE_MODE=database
```
