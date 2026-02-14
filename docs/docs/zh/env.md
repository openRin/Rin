# 环境变量列表

## 站点配置变量

:::tip
站点配置（名称、描述、头像、分页大小等）现在通过服务端配置下发，不再需要在构建时设置前端环境变量。

配置优先级：**设置页面** > **环境变量** > **默认值**
:::

| 名称          | 是否必须 | 描述                           | 默认值   | 配置键名         |
|-------------|------|------------------------------|-------|----------------|
| NAME        | 否    | 网站名称 & 标题                 | Rin   | `site.name`    |
| DESCRIPTION | 否    | 网站描述                        | A lightweight personal blogging system | `site.description` |
| AVATAR      | 否    | 网站头像地址                     | 无     | `site.avatar`  |
| PAGE_SIZE   | 否    | 默认分页限制                     | 5     | `site.page_size` |
| RSS_ENABLE  | 否    | 是否启用 RSS（启用后会在站点底部显示 RSS 链接） | false | `rss` |

:::note
你可以在部署后通过**设置页面**的「站点信息」区域修改这些配置。环境变量仅作为初始默认值使用。
:::

**部署环境变量列表**

:::caution
以下环境变量为部署到 Cloudflare Pages 必须，不能修改）
:::

| 名称                      | 值                                                          | 描述                   |
|-------------------------|------------------------------------------------------------|----------------------|
| SKIP_DEPENDENCY_INSTALL | true                                                       | 跳过默认的 npm install 命令 |
| UNSTABLE_PRE_BUILD      | asdf install bun latest && asdf global bun latest && bun i | 安装并使用 Bun 进行依赖安装     |

## 后端环境变量列表

**明文环境变量**

:::note
以下变量在 Cloudflare Workers 中保持不加密即可
:::

| 名称              | 是否必须 | 描述                                      | 默认值         | 示例值                                                             |
|-----------------|------|-----------------------------------------|-------------|-----------------------------------------------------------------|
| S3_FOLDER       | 是    | 上传保存图片时资源存放的文件路径                        | 无           | images/                                                         |
| S3_BUCKET       | 是    | S3 存储桶名称                                | 无           | images                                                          |
| S3_REGION       | 是    | S3 存储桶所在区域，如使用 Cloudflare R2 填写 auto 即可 | 无           | auto                                                            |
| S3_ENDPOINT     | 是    | S3 存储桶接入点地址                             | 无           | https://1234567890abcdef1234567890abcd.r2.cloudflarestorage.com |
| WEBHOOK_URL     | 否    | 新增评论时发送 Webhook 通知目标地址                  | 无           | https://webhook.example.com/webhook                             |
| S3_ACCESS_HOST  | 否    | S3 存储桶访问地址                              | S3_ENDPOINT | https://image.xeu.life                                          |
| S3_CACHE_FOLDER | 否    | S3 缓存文件夹（用于 SEO、高频请求缓存）                 | cache/      | cache/                                                          |

**加密环境变量，以下所有内容均为必须（Webhook 除外）**

:::note
由于部署时会清除所有不在 `wrangler.toml` 中的明文变量。\
以下环境变量在 Cloudflare Workers 中调试完毕后必须加密，否则会被清除
:::

| 名称                       | 描述                                                          | 示例值                                                              |
|--------------------------|-------------------------------------------------------------|------------------------------------------------------------------|
| RIN_GITHUB_CLIENT_ID     | Github OAuth 的客户端 ID（可选，与账号密码登录二选一）                | Ux66poMrKi1k11M1Q1b2                                             |
| RIN_GITHUB_CLIENT_SECRET | Github OAuth 的客户端密钥（可选，与账号密码登录二选一）               | 1234567890abcdef1234567890abcdef12345678                         |
| ADMIN_USERNAME           | 账号密码登录的用户名（可选，与 GitHub OAuth 二选一）                   | admin                                                            |
| ADMIN_PASSWORD           | 账号密码登录的密码（可选，与 GitHub OAuth 二选一）                     | your_secure_password                                             |
| JWT_SECRET               | JWT 认证所需密钥，可为常规格式的任意密码                                      | J0sT%Ch@nge#Me1                                                  |
| S3_ACCESS_KEY_ID         | S3 存储桶访问所需的 KEY ID，使用 Cloudflare R2 时为拥有 R2 编辑权限的 API 令牌 ID | 1234567890abcdef1234567890abcd                                   |
| S3_SECRET_ACCESS_KEY     | S3 存储桶访问所需的 Secret，使用 Cloudflare R2 时为拥有 R2 编辑权限的 API 令牌    | 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef |
