# 环境变量列表

## 前端环境变量列表

| 名称          | 是否必须 | 描述                           | 默认值   | 示例值                                              |
|-------------|------|------------------------------|-------|--------------------------------------------------|
| API_URL     | 是    | 后端地址                         | 无     | http://localhost:3001                            |
| AVATAR      | 是    | 网站左上角头像地址                    | 无     | https://avatars.githubusercontent.com/u/36541432 |
| NAME        | 是    | 网站左上角名称 & 标题                 | 无     | Xeu                                              |
| DESCRIPTION | 否    | 网站左上角描述                      | 无     | 杂食动物                                             |
| PAGE_SIZE   | 否    | 默认分页限制                       | 5     | 5                                                |
| RSS_ENABLE  | 否    | 是否启用 RSS(启用后会在站点底部显示 RSS 链接) | false | true                                             |

**部署环境变量列表**

> [!CAUTION]
> 以下环境变量为部署到 Cloudflare Pages 必须，不能修改）

| 名称                      | 值                                                          | 描述                   |
|-------------------------|------------------------------------------------------------|----------------------|
| SKIP_DEPENDENCY_INSTALL | true                                                       | 跳过默认的 npm install 命令 |
| UNSTABLE_PRE_BUILD      | asdf install bun latest && asdf global bun latest && bun i | 安装并使用 Bun 进行依赖安装     |

## 后端环境变量列表

**明文环境变量**

> [!NOTE]
> 以下变量在 Cloudflare Workers 中保持不加密即可

| 名称              | 是否必须 | 描述                                      | 默认值         | 示例值                                                             |
|-----------------|------|-----------------------------------------|-------------|-----------------------------------------------------------------|
| FRONTEND_URL    | 暂时必须 | 评论通知 Webhook 时包含评论文章链接时所需，可留空           | 无           | https://xeu.life                                                |
| S3_FOLDER       | 是    | 上传保存图片时资源存放的文件路径                        | 无           | images/                                                         |
| S3_BUCKET       | 是    | S3 存储桶名称                                | 无           | images                                                          |
| S3_REGION       | 是    | S3 存储桶所在区域，如使用 Cloudflare R2 填写 auto 即可 | 无           | auto                                                            |
| S3_ENDPOINT     | 是    | S3 存储桶接入点地址                             | 无           | https://1234567890abcdef1234567890abcd.r2.cloudflarestorage.com |
| WEBHOOK_URL     | 否    | 新增评论时发送 Webhook 通知目标地址                  | 无           | https://webhook.example.com/webhook                             |
| S3_ACCESS_HOST  | 否    | S3 存储桶访问地址                              | S3_ENDPOINT | https://image.xeu.life                                          |
| S3_CACHE_FOLDER | 否    | S3 缓存文件夹（用于 SEO、高频请求缓存）                 | cache/      | cache/                                                          |

**加密环境变量，以下所有内容均为必须（Webhook 除外）**

> [!NOTE]
> 由于部署时会清除所有不在 `wrangler.toml` 中的明文变量。\
> 以下环境变量在 Cloudflare Workers 中调试完毕后必须加密，否则会被清除

| 名称                       | 描述                                                          | 示例值                                                              |
|--------------------------|-------------------------------------------------------------|------------------------------------------------------------------|
| RIN_GITHUB_CLIENT_ID     | Github OAuth 的客户端 ID                                        | Ux66poMrKi1k11M1Q1b2                                             |
| RIN_GITHUB_CLIENT_SECRET | Github OAuth 的客户端密钥                                         | 1234567890abcdef1234567890abcdef12345678                         |
| JWT_SECRET               | JWT 认证所需密钥，可为常规格式的任意密码                                      | J0sT%Ch@nge#Me1                                                  |
| S3_ACCESS_KEY_ID         | S3 存储桶访问所需的 KEY ID，使用 Cloudflare R2 时为拥有 R2 编辑权限的 API 令牌 ID | 1234567890abcdef1234567890abcd                                   |
| S3_SECRET_ACCESS_KEY     | S3 存储桶访问所需的 Secret，使用 Cloudflare R2 时为拥有 R2 编辑权限的 API 令牌    | 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef |
