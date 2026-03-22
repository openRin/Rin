# MCP 集成

Rin 已经提供了供前端和后台写作流程使用的 REST 风格 JSON 接口。如果你希望外部 Agent 读取文章、起草内容或发布更新，更实际的做法是为现有 HTTP API 包一层轻量 MCP 服务，再配一个 Skill 提示文件。

这意味着：

- Rin 仍然是内容的唯一真实来源
- MCP 层只负责把 Agent 的工具调用翻译成 Rin 的 HTTP 请求
- 不需要为了 Agent 工作流再额外做一套内容后台

## 已有能力

当前后台 UI 已经在使用这些接口：

- `GET /api/feed`：默认列出已发布文章
- `GET /api/feed/:id`：按数字 ID 或 alias 读取单篇文章
- `POST /api/feed`：创建文章或草稿
- `POST /api/feed/:id`：更新已有文章

公开文章可通过公共 API 读取。草稿创建和文章更新需要管理员认证。

## 后台接入方式

如果你希望外部 Agent 通过 Rin 写作：

1. 先保证实例有可用的管理员登录方式。
2. 通过 `POST /api/auth/login` 或现有 GitHub 管理员登录流程完成一次认证。
3. 在 MCP 包装层转发返回的 bearer token，或 `token` Cookie，去调用仅管理员可用的接口。
4. 包装层只暴露真正需要的最小工具集合。

Rin 目前没有单独提供长期有效的内容写作 API Key，因此 MCP 包装层应当代表一个已认证的管理员账号工作。

## 建议的 MCP 工具面

第一版尽量收敛到四个工具：

- `list_posts`：调用 `GET /api/feed?page=1&limit=20`
- `get_post`：调用 `GET /api/feed/:id`
- `create_draft`：调用 `POST /api/feed`，并设置 `draft: true`
- `update_post`：调用 `POST /api/feed/:id`

这已经足够覆盖大多数编辑型 Agent 场景：

- 拉取最近文章作为上下文
- 读取单篇全文
- 起草新文章
- 修改已有草稿或已发布文章

## 示例文件

仓库里提供了两个最小示例：[`examples/mcp/openrin-blog.mcp.json`](../../../examples/mcp/openrin-blog.mcp.json) 和 [`examples/mcp/openrin-blog-writer.SKILL.md`](../../../examples/mcp/openrin-blog-writer.SKILL.md)。

它们刻意保持轻量：

- JSON 文件描述了一层基于 Rin 现有 HTTP API 的薄 MCP 映射
- Skill 文件展示了其他 Agent 如何安全地使用这些工具读写博客内容

这些文件是示例，不是仓库内置的生产级 MCP Server。

## 运行建议

- 默认把 `create_draft` 作为写入入口，审核后再发布。
- 保留 Rin 现有字段：`title`、`content`、`summary`、`tags`、`alias`、`draft`、`listed`。
- `GET /api/feed/:id` 同时接受数字 ID 和 alias，包装层需要注意区分。
- 如果 MCP 包装层会给多个 Agent 使用，建议在包装层补充审计日志和权限限制。
