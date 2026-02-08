# 更新日志

### v0.3.0 2025-02-04 更新

#### 架构重构

- **轻量级框架**：将 ElysiaJS 后端框架重构为轻量级自定义框架，专门针对 Cloudflare Workers 优化
  - 移除了约 15 个重量级依赖，核心框架代码 < 10KB
  - 实现了按需加载架构，每个请求只初始化必要的服务
  - 优化的启动时间和内存占用

#### 新增功能

- **缓存系统**：实现了支持数据库和 S3 的灵活缓存系统
  - 新增 `CACHE_STORAGE_MODE` 环境变量，支持 `database` 或 `s3` 模式
  - 支持缓存数据的自动序列化和反序列化
  - 新增缓存表用于高频数据存储

- **HyperLogLog 统计**：PV/UV 统计迁移到 HyperLogLog 算法
  - 使用 16384 个寄存器，误差率约 0.81%
  - 新增 `visit_stats` 表，包含 pv 计数器和 hll_data
  - 文章统计查询从 O(n) 优化到 O(1)
  - 大幅减少了高流量文章的查询时间

- **错误处理系统**：实现全面的错误处理机制
  - 新增结构化错误类（ValidationError, NotFoundError 等）
  - 实现 `GlobalErrorBoundary` 捕获 React 渲染错误
  - 新增 `useError` hooks 处理异步操作和 API 调用
  - 服务器端中间件记录错误并生成请求 ID

- **Cookie 认证**：从 Authorization Header 迁移到 Cookie-based 认证
  - 后端设置 HttpOnly、Secure、SameSite=lax 的 Cookie
  - 前端移除 Authorization Header，依赖浏览器 Cookie
  - 增强 CSRF 防护

#### 改进和优化

- **API 客户端重构**：用自定义 API 客户端替换 Elysia/Eden
  - 移除 @elysiajs/eden 和 rin-server 依赖
  - 创建类型安全的 API 客户端
  - 简化 API 调用方式（从 treaty 模式改为直接方法调用）
  - **破坏性变更**：客户端 API 接口变更，例如 `client.feed.index.get()` → `client.feed.list()`

- **OAuth 自定义实现**：用自定义 OAuth2 实现替换 elysia-oauth2
  - 通用 OAuth2 插件架构，支持任何 OAuth2 提供商
  - 内置 GitHub OAuth 提供商作为默认
  - 通过 state 参数验证提供 CSRF 保护
  - TypeScript 全类型支持

- **依赖注入重构**：用原生机制替换 typedi
  - 移除 typedi 依赖注入容器
  - 使用 Elysia 的 decorate() 和 derive() 进行依赖注入
  - 服务通过 store 访问依赖而非 Container.get()

- **友链系统优化**：更新 Friend 接口并调整相关 API 调用
  - 改进类型安全性

#### 修复

- 修复 uv 迁移到 hll 失败的问题
- 修复 GitHub 回调路由的 schema 验证问题
- 修复查询参数整数解析问题
- 修复 CORS 预检请求处理问题
- 优化代码并精简体积

#### 数据库迁移

- 新增缓存表 `cache`（key, type, data, created_at, updated_at）
- 新增访问统计表 `visit_stats`（feed_id, pv, hll_data）
- 数据库迁移脚本：`0006.sql`

#### 环境变量

新增环境变量：
```ini
CACHE_STORAGE_MODE=<缓存存储模式：database 或 s3，默认 database>
```

### v0.2.0 2024-06-07 更新

- 新增 `S3_CACHE_FOLDER` 环境变量
- 环境变量加密列表与变量列表更新，仅保留必须加密的环境变量
- 加密变量现在可以通过 GitHub 直接配置
- GitHub 变量配置更新，新增必须通过 GitHub 配置的加密变量（S3 存储，用于 SEO 索引保存）
- `GITHUB_CLIENT_ID`与`GITHUB_CLIENT_SECRET`现在添加了前缀`RIN_`（`RIN_GITHUB_CLIENT_ID`,`RIN_GITHUB_CLIENT_SECRET`），以解决 GitHub 变量不能以 `GITHUB_` 开头的问题，使用 Cloudflare 面板配置的 `GITHUB_CLIENT_ID` 与 `GITHUB_CLIENT_SECRET` 不受影响

## 迁移指南

无特别说明时正常的版本更新直接同步 fork 的仓库即可

### v0.2.0 迁移指南

- 由于引入 SEO 优化导致需要在 GitHub 中配置 S3 存储的环境变量，因此需要额外在 GitHub 中配置以下环境变量（明文，添加到 Variables）：

```ini
SEO_BASE_URL=<SEO 基础地址，用于 SEO 索引，默认为 FRONTEND_URL>
SEO_BASE_URL=<SEO 基础地址，用于 SEO 索引，默认为 FRONTEND_URL>
SEO_CONTAINS_KEY=<SEO 索引时只索引以 SEO_BASE_URL 开头或包含SEO_CONTAINS_KEY 关键字的链接，默认为空>
S3_FOLDER=<S3 图片资源存储的文件夹，默认为 'images/'>
S3_CACHE_FOLDER=<S3 缓存文件夹（用于 SEO、高频请求缓存），默认为 'cache/'>
S3_BUCKET=<S3 存储桶名称>
S3_REGION=<S3 存储桶所在区域，如使用 Cloudflare R2 填写 auto 即可>
S3_ENDPOINT=<S3 存储桶接入点地址>
S3_ACCESS_HOST=<S3 存储桶访问地址，末尾无'/'>
```

同时添加以下加密环境变量（加密，添加到 Secrets）：

```ini
S3_ACCESS_KEY_ID=<你的S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<你的S3SecretAccessKey>
```

以上环境变量在之前的版本中是通过 Cloudflare 面板配置的，现在需要迁移到 GitHub 中配置，新版本的部署 GitHub Action 会自动其上传到 Cloudflare，之后就不再需要在 Cloudflare 面板中配置这些环境变量了