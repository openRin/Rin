# 提交规范

本文档描述了 Rin 项目的提交信息规范。遵循这些规范可以让我们自动生成变更日志和发布说明。

## 格式

每个提交信息应遵循以下格式：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## 类型

| 类型 | 描述 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): 添加 GitHub OAuth 登录` |
| `fix` | Bug 修复 | `fix(api): 解决 CORS 问题` |
| `docs` | 文档变更 | `docs(readme): 更新部署指南` |
| `style` | 代码格式变更（格式化、分号等） | `style: 使用 prettier 格式化` |
| `refactor` | 代码重构 | `refactor(db): 优化查询性能` |
| `perf` | 性能优化 | `perf(cache): 实现 Redis 缓存` |
| `test` | 添加或更新测试 | `test(api): 添加用户认证测试` |
| `chore` | 构建过程或辅助工具变更 | `chore(deps): 更新依赖` |
| `ci` | CI/CD 变更 | `ci: 添加发布工作流` |
| `revert` | 回退更改 | `revert: 撤销破坏性变更` |

## 作用域

作用域是可选的，应指示受影响的代码区域：

- `api` - 后端 API 变更
- `client` - 前端/客户端变更
- `db` - 数据库变更
- `auth` - 认证相关
- `ui` - UI 组件
- `deps` - 依赖项
- `config` - 配置文件
- `docs` - 文档
- `release` - 发布相关

## 主题

- 使用祈使语气（"添加"而不是"添加了"或"添加"）
- 首字母不大写
- 末尾不加句号
- 最多 50 个字符

**好的示例：**
- `feat(auth): 添加密码重置功能`
- `fix(api): 处理数据库空响应`
- `docs(readme): 更新安装说明`

**不好的示例：**
- `feat: Added new feature`（过去时态，首字母大写）
- `fix: fixed the bug.`（过去时态，末尾有句号）
- `update stuff`（无类型，描述模糊）

## 正文

- 使用祈使语气
- 每行 72 个字符处换行
- 解释**做了什么**和**为什么**，而不是**怎么做**
- 与主题之间用空行分隔

示例：
```
feat(auth): 实现 JWT 令牌刷新

添加自动令牌刷新机制以防止用户意外退出登录。
令牌现在会在过期前 5 分钟刷新。

这通过无缝维护会话来改善用户体验。
```

## 页脚

- 引用 Issue 和 PR：`Closes #123`、`Fixes #456`
- 破坏性变更：`BREAKING CHANGE: 描述`

示例：
```
feat(api): 更改用户端点的响应格式

BREAKING CHANGE: 用户端点现在将用户数据包装在
`data` 字段中返回，而不是直接返回。请相应更新
您的客户端代码。

Closes #789
```

## 示例

### 功能
```
feat(articles): 添加带预览的 Markdown 编辑器

使用 Monaco Editor 实现分屏 Markdown 编辑器，支持
实时预览。支持语法高亮和图片上传。

Closes #234
```

### Bug 修复
```
fix(ui): 解决移动端导航菜单重叠问题

导航菜单在小于 768px 的屏幕上与内容重叠。
调整 z-index 和定位以解决该问题。

Fixes #567
```

### 文档
```
docs(deploy): 添加 Cloudflare 设置指南

为新的部署添加 Cloudflare Workers、D1
数据库和 R2 存储的综合指南。
```

### 破坏性变更
```
feat(auth): 迁移到新的 OAuth 提供商

BREAKING CHANGE: GitHub OAuth 实现已被替换
为通用 OAuth2 提供商。环境变量已更改：
- GITHUB_CLIENT_ID → OAUTH_CLIENT_ID
- GITHUB_CLIENT_SECRET → OAUTH_CLIENT_SECRET

迁移指南：https://docs.example.com/migration/v2
```

## 提交信息检查

我们建议使用 commitlint 来强制执行这些规范：

```bash
# 安装 commitlint
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# 创建 commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

## 为什么？

- **自动生成变更日志**：可以自动生成发布说明
- **清晰的历史记录**：易于理解发生了什么变更以及为什么
- **语义化版本控制**：帮助确定版本升级（feat=minor，fix=patch，breaking=major）
- **更好的协作**：一致的格式使代码审查更容易

## 工具

- **Commitizen**：交互式提交信息构建器
  ```bash
  npm install -g commitizen
  git cz  # 替代 git commit
  ```

- **VS Code 扩展**："Conventional Commits" 用于自动完成

## 有问题？

如果您不确定提交类型或格式，请在您的 PR 中询问或参考仓库中现有的提交。
