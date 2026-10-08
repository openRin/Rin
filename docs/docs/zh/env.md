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

Rin 支持三种对象存储后端：**Supabase Storage**、**Cloudflare R2**、**任意 S3 兼容服务**（含 R2 的 S3 API、MinIO、AWS S3）。图片、favicon、sitemap、RSS 缓存都走同一个后端。

#### 后端选择

| 变量名 | 必填 | 描述 | 默认值 | 示例 |
|--------|------|------|--------|------|
| `STORAGE_PROVIDER` | 否 | 后端类型：`supabase`/`r2`/`s3` | 自动探测 | `supabase` |

留空时按配置自动探测，**既有部署行为不变**：配了 `SUPABASE_URL` + `SUPABASE_STORAGE_BUCKET` → `supabase`；否则有 R2 binding → `r2`；否则 → `s3`。

#### 方案一：Supabase Storage

在 Supabase 控制台创建 Storage bucket，然后配置：

| 变量名 | 必填 | 描述 | 默认值 | 示例 |
|--------|------|------|--------|------|
| `SUPABASE_URL` | 是 | 项目地址 | - | `https://xxxx.supabase.co` |
| `SUPABASE_STORAGE_BUCKET` | 是 | Storage bucket 名 | - | `rin` |
| `SUPABASE_STORAGE_PUBLIC` | 否 | bucket 是否为公开桶 | `false` | `true` |

关于 `SUPABASE_STORAGE_PUBLIC`：

- `true` — 图片由 Supabase CDN 直接对外服务，**省掉 Worker 回源开销，推荐**。
- `false` — 私有桶，图片经 Worker 的 `/api/blob/*` 反代读取（用 service_role 绕过 RLS）。

:::tip
Rin 走 Supabase 的 **Storage REST API**（`/storage/v1/object/{bucket}/{path}`），只需要 Project URL 和 service_role key，**无需在 Supabase 侧另行配置 S3 凭证**。
:::

#### 方案二：S3 兼容存储（Cloudflare R2 / MinIO / AWS S3）

| 变量名 | 必填 | 描述 | 默认值 | 示例 |
|--------|------|------|--------|------|
| `S3_FOLDER` | 是 | 图片存储路径 | images/ | `images/` |
| `S3_CACHE_FOLDER` | 否 | 缓存文件路径 | cache/ | `cache/` |
| `S3_BUCKET` | 是 | S3 存储桶名称 | - | `my-bucket` |
| `S3_REGION` | 是 | S3 区域（R2 填 auto） | - | `auto` |
| `S3_ENDPOINT` | 是 | S3 接入点地址 | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | 否 | 对外访问地址 | 同 S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | 否 | 强制路径样式 | false | `false` |

:::tip
用 Cloudflare R2 时，设了 `R2_BUCKET_NAME` + `CLOUDFLARE_ACCOUNT_ID`，部署会自动生成 R2 binding 并推导 S3 参数，无需手填。
:::

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

仅当 `STORAGE_PROVIDER` 为 `s3` 时需要：

| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `S3_ACCESS_KEY_ID` | S3 访问密钥 ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | S3 访问密钥 | R2 API Token |

### Supabase 存储凭证

仅当 `STORAGE_PROVIDER` 为 `supabase` 时需要：

| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `SUPABASE_SECRET_KEY` | 高权限 key，绕过 RLS，可读写私有 bucket | Supabase 控制台 → Project Settings → API |

`SUPABASE_SECRET_KEY` 接受两种形态，代码按 key 形态自动适配鉴权头：

| 形态 | 来源 | 说明 |
|------|------|------|
| `sb_secret_...` | API → **Secret keys** | 推荐。非 JWT，只发 `apikey` 头 |
| `eyJ...`（JWT） | API → **Legacy keys** → service_role | 旧版，同时发 `apikey` + `Authorization: Bearer` |

:::tip 关于 publishable key
Supabase 新版还有 `sb_publishable_...`（对应旧的 `anon` key），但它**受 RLS 约束**，无法绕过策略直接读写私有 bucket，因此不适用于本项目的服务端存储访问。替代 `service_role` 的是 **secret key**，不是 publishable key。
:::

:::warning
`service_role` / secret key 等同于数据库超级权限，仅在 Worker 端使用。**不要**放进客户端代码或暴露在前端。Supabase 已计划在 2026 年底弃用旧的 `anon` / `service_role` key，建议直接使用新版 secret key。
:::

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
NAME                       # 网站名称
DESCRIPTION                # 网站描述
AVATAR                     # 网站头像
PAGE_SIZE                  # 分页大小
RSS_ENABLE                 # 是否启用 RSS
CACHE_STORAGE_MODE         # 缓存模式（推荐 database）
STORAGE_PROVIDER           # 存储后端：supabase / r2 / s3（可选，留空自动探测）
SUPABASE_URL               # Supabase 项目地址（provider=supabase 时必填）
SUPABASE_STORAGE_BUCKET    # Supabase Storage bucket 名
SUPABASE_STORAGE_PUBLIC    # bucket 是否公开桶（true / false）
R2_BUCKET_NAME             # 可选：设置后部署会从该 bucket 推导 S3_*；未设置时不会自动选择任何 R2 bucket
WORKER_NAME                # Worker 名称（可选）
DB_NAME                    # D1 数据库名称（可选）
```

### Repository Secrets（Settings → Secrets and variables → Secrets）

```
CLOUDFLARE_API_TOKEN      # Cloudflare API 令牌
CLOUDFLARE_ACCOUNT_ID     # Cloudflare 账户 ID
SUPABASE_SECRET_KEY # Supabase service_role key（provider=supabase 时必填）
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

# 或者用 Supabase Storage
# STORAGE_PROVIDER=supabase
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_STORAGE_BUCKET=rin
# SUPABASE_STORAGE_PUBLIC=true
# SUPABASE_SECRET_KEY=sb_secret_xxx

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
