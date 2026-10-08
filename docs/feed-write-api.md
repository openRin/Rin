# 文章写入 API

供脚本、CI、外部工具调用。**全部端点要求管理员权限**（`permission === 1`）。

## 为什么不用 `POST /api/feed`

网页端的创建文章接口已经存在且是 `adminOnly`，但它是为网页表单设计的，
对脚本不友好：

| 问题 | 网页端 `/api/feed` | 本 API `/api/feed-write` |
|---|---|---|
| 响应格式 | 纯文本 `Created` / 错误文案 | 结构化 JSON，带 `success` 与 `code` |
| 试运行 | 无 | `dryRun: true` 只校验不写库 |
| 局部更新 | 强制要求带 `listed` | 全部字段可选，不传即不改 |
| 删除确认 | 无 | 要求 `?confirm=<id>` 与 id 一致 |

## 鉴权

用管理员的 JWT Cookie 或 Bearer Token：

```bash
curl -X POST https://your-blog.com/api/feed-write \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <管理员 JWT>" \
  -d '{
    "title": "我的新文章",
    "content": "# 正文\n\nMarkdown 内容",
    "draft": false,
    "listed": true,
    "tags": ["随笔"]
  }'
```

| 状态 | 含义 |
|---|---|
| 401 | 未登录 |
| 403 | 已登录但不是管理员 |

> **拿不到 Token？** 用 `POST /api/auth/login` 换一个。
> 注意它用的是**用户名**（`username`）而非邮箱，字段是 `username` + `password`：
>
> ```bash
> curl -X POST .../api/auth/login \
>   -H "Content-Type: application/json" \
>   -d '{"username":"<管理员用户名>","password":"<密码>"}'
> # → {"success":true,"token":"<JWT>", "user":{...}}
> ```
>
> 该接口也会把 Token 写进 HttpOnly Cookie，所以浏览器直接调用无需手动带
> Authorization 头；**脚本**则需要用响应里的 `token` 字段自己带。

## 响应格式

所有响应统一两个字段，脚本可以无脑判断：

```jsonc
// 成功
{ "success": true, "data": { ... } }

// 失败
{ "success": false, "error": { "code": "FEED_ALREADY_EXISTS", "message": "..." } }
```

`code` 用于分支处理，`message` 只作兜底展示。

## 创建文章

`POST /api/feed-write`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | ✅ | 标题 |
| `content` | string | ✅ | 正文（Markdown） |
| `draft` | boolean | ✅ | 是否草稿 |
| `listed` | boolean | ✅ | 是否出现在列表页 |
| `summary` | string | — | 摘要 |
| `alias` | string | — | 自定义路径 |
| `tags` | string[] | — | 标签名数组 |
| `createdAt` | ISO 日期 | — | 留空用当前时间 |
| `dryRun` | boolean | — | `true` 时只校验不写库 |

```bash
# 先试运行，确认无误再真写
curl -X POST .../api/feed-write -d '{"title":"标题","content":"内容","draft":false,"listed":true,"tags":[],"dryRun":true}'
# → {"success":true,"data":{"dryRun":true,"created":false,"wouldCreate":{...}}}

# 正式创建
curl -X POST .../api/feed-write -d '{"title":"标题","content":"内容","draft":false,"listed":true,"tags":[]}'
# → {"success":true,"data":{"dryRun":false,"created":true,"id":42,"url":"/feed/42","title":"标题","draft":false}}
```

`dryRun` 在正式创建时也会返回（值为 `false`），这样调用方可以统一用
「读 dryRun 判断是否为试运行结果」的方式处理两种响应。

`dryRun` 放在 body 里而不是 query，这样切换试运行不用改 URL。
**试运行同样会做重复检测** —— 免得试运行时通过、真写时才报冲突。

## 更新文章

`PUT /api/feed-write/:id`

所有字段可选，**不传即不改**。

```bash
curl -X PUT .../api/feed-write/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"改过的标题"}'
```

## 删除文章

`DELETE /api/feed-write/:id?confirm=<id>`

**必须带 `?confirm=<id>` 且值与 id 一致。** 这是不可逆操作，
少一层校验就可能因为脚本传错 id 而永久丢文章。

```bash
curl -X DELETE ".../api/feed-write/42?confirm=42" -H "Authorization: Bearer <token>"
```

## 读取文章

`GET /api/feed-write/:id`

写 API 的配套读接口，方便脚本确认写入结果。

## 错误码

| code | 状态 | 含义 |
|---|---|---|
| `AUTH_LOGIN_REQUIRED` | 401 | 未登录 |
| `FEED_PERMISSION_DENIED` | 403 | 不是管理员 |
| `FEED_VALIDATION_FAILED` | 400 | 请求体不合法 |
| `FEED_NOT_FOUND` | 404 | 文章不存在 |
| `FEED_ALREADY_EXISTS` | 409 | 标题与内容都重复 |
| `FEED_CREATE_FAILED` | 500 | 写入失败 |
| `FEED_DELETE_FAILED` | 500 | 删除失败 |

## 脚本示例

```bash
#!/usr/bin/env bash
set -euo pipefail

API="${RIN_API:-https://your-blog.com}"
TOKEN="${RIN_TOKEN:?请先设置管理员 Token}"

resp=$(curl -sf -X POST "$API/api/feed-write" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"$(date +%F) 日记\",\"content\":\"$(cat note.md)\",\"draft\":false,\"listed\":true,\"tags\":[\"日记\"]}")

id=$(echo "$resp" | jq -r '.data.id')
echo "已发布: $API/post/$id"
```

失败时 `curl -f` 会因非 2xx 退出；想自己处理错误就去掉 `-f`，
判断 `.success` 字段。
