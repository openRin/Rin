# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file contains **detailed** changelog information for each release.
For a quick overview of changes, see the [GitHub Releases](https://github.com/openRin/Rin/releases) page
which automatically generates release notes from commit messages.

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [v0.3.0-rc.2] - 2026-03-08

### Overview
This prerelease focuses on feed presentation controls and a cleaner settings experience. It adds configurable article card styles, optional masonry feed layout, and a unified preview shell for personalization settings while carrying forward the previously merged blurhash loading fixes from `rc1`.

### Added
- **Feed presentation settings**: Added configurable feed card styles and feed layout options in settings.
- **Editorial card variant**: Added a new editorial-style feed card variant with stronger visual hierarchy.
- **Shared preview shell**: Added a shared settings preview card used by header layout and feed card style previews.

### Changed
- **Feed browsing experience**: Feed, search, and hashtag pages can now render cards in either a standard list or a two-column masonry layout.
- **Settings personalization UI**: Unified preview styling between header and feed card settings and simplified layout selection UX by removing redundant feed layout previews.

### Fixed
- **Card rendering polish**: Fixed feed card image clipping, preview overflow, header compact preview sizing, and summary length behavior in denser layouts.

## [v0.3.0-rc.1] - 2026-03-06

### Overview
This prerelease rolls up the work completed after `v0.2.0` into a single upgrade candidate focused on the new runtime architecture, shared packages, and day-to-day operability. The largest changes are the backend runtime migration, the custom API client/auth flow, and the move toward unified local tooling and configuration management.

### Added
- **Unified Rin CLI**: Added a first-party CLI entrypoint for local development, deployment, database tasks, and release preparation.
- **Shared workspace packages**: Introduced `@rin/api`, `@rin/config`, and `@rin/ui` as real shared packages used by the app.
- **Authentication options**: Added password-based admin login, a dedicated `/login` page, and a `/profile` page for avatar and nickname updates.
- **AI configuration**: Added AI summary support, custom model support, and merged AI settings into the main server configuration flow.
- **Content features**: Added Moments, search, pinned/top feeds, adjacent feed navigation, friend sorting and apply flows, visit count display, and compatibility task management pages.
- **Editor and rendering enhancements**: Added Monaco editor improvements, Mermaid, KaTeX, callouts, alerts, popup support, code-copy actions, image lightbox support, richer markdown image handling, and WordPress import tooling.
- **Internationalization**: Added Japanese and Traditional Chinese translations, and expanded translation coverage across the app.

### Changed
- **Backend runtime**: Replaced the old Elysia-based server stack with a lighter Worker-oriented runtime and then a Hono-based app assembly, with lazy route/dependency loading and clearer middleware boundaries.
- **API client**: Replaced Eden Treaty usage with a custom type-safe API client and shared transport contracts in `@rin/api`.
- **Authentication transport**: Moved authenticated requests from authorization headers to cookie-based sessions and replaced the previous OAuth dependency with an in-repo OAuth implementation.
- **Statistics and caching**: Migrated PV/UV aggregation to HyperLogLog and added cache persistence modes for both D1 and S3.
- **Configuration and deployment**: Simplified local development setup, removed legacy `FRONTEND_URL` and `API_URL` assumptions, and updated CI/deploy workflows around generated Wrangler configuration and repository-level variables.
- **Release packaging**: GitHub Releases now include the packaged Cloudflare build artifact so manual deployments can consume the release asset URL directly.
- **Documentation**: Moved documentation into the main repository and added release/deployment guidance for the newer workflow.

### Removed
- **Legacy backend dependencies**: Removed the old Elysia/Eden/Treaty-oriented release path from the supported architecture.
- **SEO-specific server rendering path**: Removed the previous SEO-only server rendering flow in favor of the current runtime behavior.

### Fixed
- **RSS and feed delivery**: Fixed broken RSS routes, cron edge cases, adjacent feed response fields, and S3 path-style handling.
- **Deployment workflow reliability**: Fixed CI environment propagation, Wrangler version mismatches, queue creation/naming issues, and shell pipeline error handling in release/deploy workflows.
- **Cross-origin and routing behavior**: Fixed CORS/OPTIONS handling, integer query parsing, and custom API URL usage.
- **Existing UI regressions**: Fixed image placeholder metadata, blurhash support in feed cards, timeline rendering, index scrolling/mobile behavior, and several cache initialization issues that affected pre-existing pages.

### Migration Guide

#### For Existing Users Upgrading From v0.2.0

1. **Update custom API calls**:
   - Eden Treaty-style calls such as `client.feed.index.get(...)` are no longer supported.
   - Migrate to the new client methods such as `client.feed.list(...)`.
2. **Review auth integration**:
   - Authentication now uses cookies and dedicated login/profile pages.
   - If you customized the previous modal/login callback flow, re-test that integration before promoting this prerelease.
3. **Review runtime/config assumptions**:
   - `FRONTEND_URL` and `API_URL` are no longer part of the current deployment model.
   - Prefer the repository-level variables and generated Wrangler config used by the current workflows.
4. **Pick a cache backend deliberately**:
   - Set `CACHE_STORAGE_MODE=database` if you want to run without S3-backed cache persistence.
   - Keep S3 configuration in place if you still want object-storage-backed cache assets.

### Known Issues
- This is still a prerelease for the `0.3.0` line; downstream forks with custom auth, deployment, or API wrappers should validate their integrations before treating it as production-ready.

### 中文版

#### 概览
这个预发布版本将 `v0.2.0` 之后完成的大量工作整理为一个可验证的升级候选版本，重点集中在新的运行时架构、共享包抽取，以及日常开发和部署可维护性的提升。最大的变化包括后端运行时迁移、自定义 API client 与认证流程，以及统一的本地工具链。

#### 新增
- **统一 Rin CLI**：新增一套一方维护的 CLI 入口，用于本地开发、部署、数据库任务和 release 准备。
- **共享 workspace 包**：引入 `@rin/api`、`@rin/config` 和 `@rin/ui`，作为应用当前实际使用的共享包。
- **认证方式扩展**：新增账号密码登录、独立 `/login` 页面，以及可更新头像和昵称的 `/profile` 页面。
- **AI 配置能力**：新增 AI 摘要、自定义模型支持，并将 AI 设置并入主服务端配置流程。
- **内容能力**：新增 Moments、搜索、置顶文章、相邻文章、友情链接排序与申请流程、访问统计展示以及兼容性任务管理页面。
- **编辑器与渲染增强**：新增 Monaco 编辑器改进、Mermaid、KaTeX、Callout、Alert、弹出层、代码复制、图片灯箱以及更丰富的 Markdown 图片处理能力，并支持 WordPress 导入。
- **国际化**：新增日语与繁体中文翻译，并扩展了应用中的多语言覆盖范围。

#### 变更
- **后端运行时**：将旧的 Elysia 服务端栈替换为更轻量的 Worker 运行时，并进一步整理为 Hono 应用装配结构，支持懒加载路由与依赖，并使中间件边界更清晰。
- **API client**：移除 Eden Treaty 调用方式，改为自定义的类型安全 API client，并通过 `@rin/api` 共享传输契约。
- **认证传输**：认证请求从 Authorization Header 迁移为 Cookie Session，同时将原 OAuth 依赖替换为仓库内实现。
- **统计与缓存**：PV/UV 统计迁移到 HyperLogLog，并为缓存新增 D1 与 S3 两种持久化模式。
- **配置与部署**：简化本地开发设置，移除旧的 `FRONTEND_URL` 与 `API_URL` 假设，并更新围绕 Wrangler 生成配置和仓库级变量的 CI / 部署流程。
- **发布产物**：GitHub Releases 现在会附带打包后的 Cloudflare 构建产物，便于手动部署时直接使用 release asset URL。
- **文档**：文档已迁移回主仓库，并补充了与当前流程匹配的发布与部署说明。

#### 移除
- **旧后端依赖路径**：移除了旧的 Elysia / Eden / Treaty 相关支持路径，不再作为当前架构的一部分。
- **SEO 专用服务端渲染流程**：移除了之前面向 SEO 的单独服务端渲染路径，改为当前运行时行为。

#### 修复
- **RSS 与 feed 交付**：修复了 RSS 路由、定时任务边缘情况、相邻文章返回字段以及 S3 path-style 相关问题。
- **部署流程稳定性**：修复了 CI 环境变量传递、Wrangler 版本不一致、队列创建与命名问题，以及 release / deploy 流程中的 shell pipeline 错误处理。
- **跨域与路由行为**：修复了 CORS / OPTIONS 处理、整数 query 解析以及自定义 API URL 的使用问题。
- **既有 UI 回归**：修复了图片占位元数据、feed card blurhash、时间线渲染、索引页滚动 / 移动端行为，以及多个影响旧页面的缓存初始化问题。

#### 迁移指南

##### 从 v0.2.0 升级的现有用户

1. **更新自定义 API 调用**：
   - 旧的 Eden Treaty 风格调用，例如 `client.feed.index.get(...)`，已不再支持。
   - 请迁移到新的 client 方法，例如 `client.feed.list(...)`。
2. **检查认证集成**：
   - 认证现在基于 Cookie，并使用独立的登录 / 资料页面。
   - 如果你定制过旧的 modal 登录或 callback 流程，建议在推广这个 prerelease 前重新验证。
3. **检查运行时 / 配置假设**：
   - `FRONTEND_URL` 和 `API_URL` 已不再属于当前部署模型。
   - 优先采用当前 workflow 使用的仓库级变量和生成式 Wrangler 配置。
4. **明确缓存后端选择**：
   - 如果你希望不依赖 S3 持久化缓存，可设置 `CACHE_STORAGE_MODE=database`。
   - 如果你仍需对象存储缓存资产，请保留 S3 相关配置。

#### 已知问题
- 这仍然是 `0.3.0` 版本线的预发布版本；对认证、部署或 API 包装做过深度定制的下游 fork，仍应先完成自有环境验证，再将其视为生产可用版本。

## [v0.2.0] - 2024-06-07

### Overview
This release focuses on simplifying deployment and configuration management by migrating environment variables from Cloudflare panel to GitHub Secrets/Variables.

### Added
- **SEO Caching**: Added `S3_CACHE_FOLDER` environment variable for SEO pre-rendering cache storage
- **GitHub-based Configuration**: Environment variables can now be configured directly through GitHub Secrets/Variables instead of Cloudflare panel
- **Automated Release Workflow**: Added automated release process with version validation and changelog generation
- **Version Consistency Checks**: CI now validates version consistency across all package.json files

### Changed
- **OAuth Variable Names**: Changed GitHub OAuth variable names to use `RIN_` prefix to comply with GitHub's naming restrictions:
  - `GITHUB_CLIENT_ID` → `RIN_GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET` → `RIN_GITHUB_CLIENT_SECRET`
- **Deployment Triggers**: Deployment now triggers only on version tags (e.g., `v0.2.0`) instead of branch pushes
- **Environment Management**: Migrated all environment variable management from Cloudflare panel to GitHub

### Migration Guide

#### For Existing Users

If you're upgrading from v0.1.0, follow these steps:

1. **Add new environment variables to GitHub Variables**:
   ```ini
   SEO_BASE_URL=<SEO base URL>
   SEO_CONTAINS_KEY=<SEO filter keyword, optional>
   S3_FOLDER=<S3 images folder, default: 'images/'>
   S3_CACHE_FOLDER=<S3 cache folder, default: 'cache/'>
   S3_BUCKET=<S3 bucket name>
   S3_REGION=<S3 region, use 'auto' for Cloudflare R2>
   S3_ENDPOINT=<S3 endpoint URL>
   S3_ACCESS_HOST=<S3 access URL>
   ```

2. **Add new secrets to GitHub Secrets**:
   ```ini
   S3_ACCESS_KEY_ID=<Your S3 Access Key ID>
   S3_SECRET_ACCESS_KEY=<Your S3 Secret Access Key>
   ```

3. **Update OAuth variables** (if using GitHub OAuth):
   - Rename `GITHUB_CLIENT_ID` to `RIN_GITHUB_CLIENT_ID`
   - Rename `GITHUB_CLIENT_SECRET` to `RIN_GITHUB_CLIENT_SECRET`

4. **Remove from Cloudflare** (optional):
   - These variables are now managed through GitHub and will be automatically deployed
   - You can remove them from Cloudflare Workers environment variables if they exist there

### Technical Details

#### Deployment Changes
- Previous: Deployment triggered on every push to `main`, `dev`, or `fix/*` branches
- Now: Deployment only triggers on version tags (e.g., `v0.2.0`)
- Benefit: More controlled releases, prevents accidental deployments

#### Configuration Changes
- Previous: Sensitive variables configured in Cloudflare panel
- Now: All variables configured in GitHub Secrets/Variables
- Benefit: Single source of truth, better version control integration

### Known Issues
- None reported

### Contributors
- Thanks to all contributors who helped with this release!

## [v0.1.0] - 2024-XX-XX

### Added
- 🎉 Initial release of Rin blog platform
- **Backend**: Cloudflare Workers with Elysia framework
- **Frontend**: React + Vite + Tailwind CSS hosted on Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite-based edge database)
- **Storage**: Cloudflare R2 for image storage
- **Authentication**: GitHub OAuth integration
- **Editor**: Monaco Editor with Markdown support
- **Comments**: Comment system with Webhook notifications
- **RSS**: RSS feed generation
- **SEO**: SEO optimization with pre-rendering
- **i18n**: Multi-language support
- **Friend Links**: Automated health checks for friend links (every 20 minutes)

### Features
- Real-time local saving for article drafts
- Image upload and management
- Article tagging and categorization
- Responsive design
- Dark mode support
- Scheduled tasks via Cloudflare Cron Triggers

[Unreleased]: https://github.com/openRin/Rin/compare/v0.3.0-rc.2...HEAD
[v0.3.0-rc.2]: https://github.com/openRin/Rin/compare/v0.3.0-rc.1...v0.3.0-rc.2
[v0.3.0-rc.1]: https://github.com/openRin/Rin/compare/v0.2.0...v0.3.0-rc.1
[v0.2.0]: https://github.com/openRin/Rin/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/openRin/Rin/releases/tag/v0.1.0
