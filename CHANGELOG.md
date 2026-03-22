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

## [v0.3.0] - 2026-03-12

### Overview
This stable release finalizes the `0.3.0` line after the `rc1` and `rc2` rollout, promoting the new runtime architecture, shared package boundaries, and customization work to general availability. It also includes the final stabilization fixes completed after `rc.2`, with extra attention on routing, storage blob delivery, and production safety around assets and admin access.

### Added
- **Stable `0.3.0` baseline**: Promoted the new Worker runtime, shared workspace package structure, unified CLI workflows, and expanded site customization features from prerelease to stable.

### Changed
- **Release line hardening**: Consolidated the `rc1` and `rc2` feature set into the first stable `0.3.x` release so new installations and upgrades can target a non-prerelease version.

### Fixed
- **Storage blob routing**: Fixed storage blob delivery through API routes and restored correct streaming behavior when no public asset host is configured.
- **Asset path fallback behavior**: Fixed dotted-path routing so real asset requests continue to resolve correctly while non-asset paths still fall back to the application.
- **Admin availability**: Fixed an auth regression that could block admin access when login visibility was disabled.
- **Navigation and rendering regressions**: Fixed post-navigation scroll restoration, adjacent feed API response handling, table-of-contents anchor offsets, footer script execution, and bootstrap config loading in the app shell.
- **Webhook and cache behavior**: Fixed webhook error handling, cache gating, and several runtime/config edge cases discovered during the prerelease cycle.

### 中文版

#### 概览
这个正式版在 `rc1` 与 `rc2` 的基础上完成了 `0.3.0` 版本线的收口，将新的 Worker 运行时架构、共享 workspace 包边界、统一 CLI 流程以及站点个性化能力正式提升为稳定可用状态。同时，它也吸收了 `rc.2` 之后最后一轮稳定性修复，重点覆盖路由回退、存储 Blob 访问，以及生产环境中的静态资源与管理员访问安全性。

#### 新增
- **稳定版 `0.3.0` 基线**：将新的 Worker 运行时、共享包结构、统一 CLI 工作流，以及扩展后的站点自定义能力从预发布状态正式提升为稳定版本。

#### 变更
- **发布线稳定收口**：将 `rc1` 与 `rc2` 的功能集合并为首个稳定的 `0.3.x` 正式版，使新部署与升级流程不再依赖 prerelease 版本号。

#### 修复
- **存储 Blob 路由**：修复了通过 API 路由访问存储 Blob 的行为，并恢复了在未配置公共资源 Host 时的正确流式返回逻辑。
- **资源路径回退行为**：修复了带点号路径的路由回退问题，确保真实静态资源请求仍能正确命中，同时非资源路径依然能回退到应用入口。
- **管理员可用性**：修复了在隐藏登录入口时可能导致管理员访问受阻的认证回归问题。
- **导航与渲染回归**：修复了页面跳转后的滚动恢复、相邻文章 API 响应处理、目录锚点被 Header 遮挡、页脚脚本执行，以及应用壳配置注入加载等问题。
- **Webhook 与缓存行为**：修复了 Webhook 错误处理、缓存启用边界，以及在预发布阶段发现的多项运行时 / 配置边缘问题。

## [v0.3.0-rc.2] - 2026-03-08

### Overview
This prerelease expands `rc1` with a second round of UI and operability improvements centered on site customization, content maintenance, and deployment reliability. The largest user-facing changes are the new customizable header layouts, feed card presentation settings, and a tighter configuration experience around theme color, favicon, webhook handling, and compatibility backfill tasks.

### Added
- **Customizable header layouts**: Added multiple header layout options with live previews, including a more compact text-first header variant.
- **Feed presentation settings**: Added configurable feed card styles and feed layout options in settings.
- **Editorial card variant**: Added a new editorial-style feed card variant with stronger visual hierarchy.
- **Shared preview shell**: Added a shared settings preview card used by header layout and feed card style previews.
- **Theme color controls**: Added configurable theme color options and runtime theme color application for the client.
- **Forced AI compat backfill**: Added support for running compatibility backfill tasks even when AI summary state was already initialized.
- **Webhook documentation**: Added dedicated English and Chinese webhook guides to the docs.

### Changed
- **Feed browsing experience**: Feed, search, and hashtag pages can now render cards in either a standard list or a two-column masonry layout.
- **Settings personalization UI**: Reworked the personalization section to cover header layout, theme color, feed card style, and feed layout with shared preview chrome and cleaner option grouping.
- **Header architecture**: Split the old monolithic header into layout definitions, preview primitives, and reusable primitives so layout changes are easier to extend.
- **Favicon handling**: Site favicon behavior now prefers the configured favicon route and can fall back to the site avatar more gracefully.
- **Visibility of traffic stats**: PV/UV display now correctly follows the counter setting and stays hidden when statistics are disabled.

### Fixed
- **Blurhash and image metadata**: Fixed blurhash loading races, preserved image metadata in feed avatars, and ensured feed card images fill their container correctly after load.
- **Card rendering polish**: Fixed feed card image clipping, preview overflow, compact header preview sizing, and summary length behavior in denser layouts.
- **Webhook template handling**: Fixed URL encoding for webhook GET template parameters while preserving template strings through configuration save/load flows.
- **Deployment workflow reliability**: Fixed preview deployments to sync worker secrets correctly and tightened build/release validation around deploy artifacts.
- **Compatibility task flow**: Fixed AI summary compatibility task response typing and improved compat task action spacing in the UI.
- **Editor and route edge cases**: Fixed markdown editor preview visibility in edit mode and ensured `/favicon.ico` is served correctly.

### 中文版

#### 概览
这个预发布版本在 `rc1` 的基础上继续推进 UI 与可运维性改进，重点放在站点个性化、内容维护，以及部署可靠性上。最显著的用户侧变化包括可配置的 Header 布局、文章卡片展示设置，以及围绕主题色、网站图标、Webhook 处理和兼容性补齐任务的整体体验打磨。

#### 新增
- **可配置 Header 布局**：新增多种 Header 布局选项和实时预览，包括更紧凑的纯文本风格布局。
- **文章列表展示设置**：在设置页中新增文章卡片样式和列表布局选项。
- **Editorial 卡片样式**：新增一个更强调视觉层级的文章卡片主题。
- **共享预览外壳**：新增一套共享的设置预览卡组件，用于统一 Header 布局和文章卡片样式预览。
- **主题色控制**：新增客户端主题色选项，并支持运行时应用站点主题色。
- **强制兼容性补齐**：新增 AI 兼容性任务的强制补齐能力，即使摘要状态已经初始化也可以重新执行。
- **Webhook 文档**：补充了中英文的专用 Webhook 使用文档。

#### 变更
- **文章浏览体验**：文章列表、搜索结果页和标签页现在可以在单列列表与双列瀑布流之间切换。
- **设置页个性化 UI**：重构了个性化设置区，统一管理 Header 布局、主题色、文章卡片样式和列表布局，并通过共享预览外壳保持视觉一致。
- **Header 架构**：将原本较为集中的 Header 实现拆分为布局定义、预览基础组件和可复用 primitive，使后续布局扩展更容易维护。
- **网站图标处理**：网站 favicon 的处理流程现在更明确地优先走配置路由，并能更自然地回退到站点头像。
- **访问量显示逻辑**：PV/UV 显示现在会正确跟随统计开关，在禁用统计时不再继续展示。

#### 修复
- **Blurhash 与图片元数据**：修复了 blurhash 加载竞态，保留了 feed 头像中的图片元数据，并确保文章卡片图片在加载完成后正确填满容器。
- **卡片渲染细节**：修复了文章卡片图片裁切、预览区域 overflow、极简 Header 预览尺寸，以及高密度布局下摘要长度控制等问题。
- **Webhook 模板处理**：修复了 Webhook GET 请求模板参数的 URL 编码问题，同时保证模板字符串在配置读写流程中不被破坏。
- **部署流程稳定性**：修复了 preview 部署时的 Worker Secret 同步问题，并加强了构建产物部署脚本的校验。
- **兼容性任务流程**：修复了 AI 兼容性任务响应类型问题，并优化了兼容性任务操作区的间距表现。
- **编辑器与路由边缘情况**：修复了编辑模式下 markdown 预览显示问题，并确保 `/favicon.ico` 路由可正常访问。

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
[v0.3.0]: https://github.com/openRin/Rin/releases/tag/v0.3.0
