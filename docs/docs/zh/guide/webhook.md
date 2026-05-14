# Webhook 指南

Rin 可以在以下场景向自定义 webhook 发送通知：

- 有新评论时
- 有新的友链申请时

你可以用它把 Rin 接到 Discord、Telegram Bot、Slack 网关、飞书、钉钉、n8n、Zapier，或者你自己的 HTTP 服务。

## 在哪里配置

部署完成后，进入后台 **设置** 页面，找到 **Webhook** 配置区。

你也可以通过 `WEBHOOK_URL` 环境变量提供一个初始默认值，但更推荐在设置页里统一管理 webhook 行为。

## 支持的配置项

Rin 当前支持以下 webhook 配置：

- `Webhook URL`：目标地址。这里也支持模板变量，尤其适合 GET 场景拼接 query string。
- `Webhook Method`：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS`
- `Webhook Content-Type`：例如 `application/json`、`text/plain`
- `Webhook Headers`：用于自定义请求头的 JSON 模板
- `Webhook Body Template`：非 GET 请求使用的请求体模板
- `发送测试 Webhook`：使用当前页面上的值发送一次测试请求，未保存的修改也会生效

## 模板变量

你可以在 webhook URL、请求头和请求体模板中使用这些变量：

- `{{event}}`
- `{{message}}`
- `{{title}}`
- `{{url}}`
- `{{username}}`
- `{{content}}`
- `{{description}}`

## 默认行为

如果你只配置了 `Webhook URL`，Rin 默认会使用：

- Method：`POST`
- Content-Type：`application/json`
- Headers：`{}`
- Body：

```json
{"content":"{{message}}"}
```

## GET 示例

如果你的 webhook 服务希望通过 query 参数接收内容，可以直接在 URL 中写模板变量：

```text
https://example.com/webhook?event={{event}}&message={{message}}&title={{title}}
```

推荐配置：

- Method：`GET`
- Body Template：保持默认或忽略

Rin 会对 GET 风格 URL 中的查询参数值进行 URL 编码。

## JSON POST 示例

如果你的服务接收 JSON，可以这样配置：

**Webhook URL**

```text
https://example.com/webhook
```

**Webhook Headers**

```json
{
  "X-Rin-Event": "{{event}}"
}
```

**Webhook Body Template**

```json
{
  "event": "{{event}}",
  "message": "{{message}}",
  "title": "{{title}}",
  "url": "{{url}}",
  "username": "{{username}}",
  "content": "{{content}}",
  "description": "{{description}}"
}
```

## 说明

- `GET` 和 `HEAD` 请求不会发送请求体。
- webhook URL 中的模板变量在替换前会先进行 URL 编码。
- `Webhook Headers` 在模板渲染后必须仍然是合法 JSON。
- 如果 `Webhook Headers` 或 `Webhook Body Template` 本身是合法 JSON，Rin 会按 JSON 字符串规则转义插入值，避免破坏 JSON 结构。
- 如果请求体模板不是合法 JSON，Rin 会保持原有的纯文本替换行为。
- 在正式保存前，建议先用“发送测试 Webhook”验证一次。

## 常见问题

### 测试 webhook 时报 JSON 错误

说明 `Webhook Headers` 在模板渲染后不是合法 JSON。请检查逗号、引号和括号是否正确。

### 请求发出去了，但服务端拒绝了

请重点检查：

- HTTP Method
- `Content-Type`
- 认证请求头
- JSON 字段名是否符合对方要求
- 对方接口是接收 GET query 参数，还是只接收 POST body

### 我只想收到一条简单消息

保持默认配置，只填写 `Webhook URL` 即可。Rin 会发送：

```json
{"content":"<message>"}
```
