# 部署

项目目前处于开发阶段，文档可能未及时更新或存在描述不清，如遇部署失败请提 [Issue](https://github.com/OXeu/Rin/issues/new?assignees=&labels=help+wanted&projects=&template=need-help.md&title=%5BHelp%5D+%E9%97%AE%E9%A2%98%E6%8F%8F%E8%BF%B0)

> [!TIP]
> 我们在文档末尾追加了完整的部署流程演示视频，以便解决您在部署期间遇到的部分困难
> [点击直达](#操作视频)

## 更新日志

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

## 其他文档

[环境变量列表](./ENV.md)

> [!TIP]
> 下文代码块中若出现形如 <文字> 的内容表示需要根据文字提示替换为自己的内容（`<`和`>`不要保留），如：
>
> ```
> bun wrangler d1 create <数据库名称>
> ```
>
> 表示将 <数据库名称> 替换为你喜欢的名称，这里使用 rin 替换：
>
> ```
> bun wrangler d1 create rin
> ```
>
> 这就是最终的命令

打开仓库页面：https://github.com/OXeu/Rin

## Fork

点击 Fork 按钮 fork 出一个新仓库
![1000000657](https://github.com/OXeu/Rin/assets/36541432/df3607ca-a8a9-49b8-92ce-6b348afeb13f)

## 前端

> [!TIP]
> 先简单介绍一下前端与后端的关系，前端是一个静态页面，托管于 Cloudflare Pages上，前端本质上只是一堆不会变化的文件和代码，并没有你的文章数据之类的内容，想要实现如登录，写文章，评论，获取文章列表和内容、评论列表等逻辑还需要与后端进行数据交换；
> 
> 后端负责处理具体的逻辑，在本项目中后端运行在 Cloudflare Workers 上，前端通过 API 与后端通信，后端通过 Cloudflare D1 保存文章等数据，通过 Cloudflare R2 存储文章中的图片
> 
> 下文提到的前端与后端你可以分别等价代换为 Cloudflare Pages 与 Cloudflare Workers，当提到说需要前端地址或者后端地址时，即为 Cloudflare Pages 地址或 Cloudflare Workers 地址，你可以在 Cloudflare 控制面板中通过少量的操作找到这两个地址，如下面的截图所示：
> 前端（Pages）的地址在 `Workers 和 Pages` > 你的 Pages 项目 > `部署` 中可以找到：
> ![图片](https://github.com/OXeu/Rin/assets/36541432/d9dcc5f2-6930-4487-af4b-0ab52e948114)
> 图中的`rin-6qe.pages.dev`,`direct.xeu.life` 都是前端地址，如果有更多的地址，你还可以点击形如 `+2 个域` 的链接查看更多的地址，这些地址都是可以访问的，你可以使用其中任意一个地址，但是需要保持不同地方都填写的是同一个前端地址（如果有多个环境变量要求填写前端地址的话），通常来说前端地址是 `https://rin-6qe.pages.dev` 或 `https://direct.xeu.life` 这样的形式
>
> 后端（Workers）的地址在 `Workers 和 Pages` > 你的 Workers 项目 > `设置` > `触发器` 中可以找到：
> ![图片](https://github.com/OXeu/Rin/assets/36541432/0a2385b7-94db-4469-bef9-399cc334f1b6)
> 图中的 `rin.xeu.life` 和 `rin-server.xeu.workers.dev` 都是后端地址，前者是自定义域名，后者是默认分配的域名，你可以使用默认分配的域名，也可以自定义域名，自定义域名需要在 Cloudflare 控制面板中进行配置，在本文档中当要求填写后端地址时，你可以填写形如 `https://rin.xeu.life` 或 `https://rin-server.xeu.workers.dev`的地址，但需保持不同地方都填写的是同一个后端地址（如果有多个环境变量要求填写后端地址的话）

登录 [Cloudflare](https://dash.cloudflare.com) 控制台，进入 `Workers 和 Pages` 页面，点击`创建应用程序`，选择 Pages

![1000000658](https://github.com/OXeu/Rin/assets/36541432/35d4f9e3-3af3-4ec8-8060-2a352f4d51ae)

点击连接到 Git 连接自己的 GitHub 账号并选择 Fork 的存储库

![1000000666](https://github.com/OXeu/Rin/assets/36541432/e3b6da75-1a5f-46ec-9820-636cc5238023)

点击 `开始设置` 进入配置页面：

构建设置按照填入以下内容：

```
框架预设：无
构建命令：bun b
构建输出目录：client/dist
路径：<留空>
```

![1000000659](https://github.com/OXeu/Rin/assets/36541432/98fb3021-932b-4bfa-8118-3378f98ff628)

环境变量复制以下内容，根据自身情况修改变量值：

> [!IMPORTANT]
> 最后两行环境变量 `SKIP_DEPENDENCY_INSTALL` 和 `UNSTABLE_PRE_BUILD` 为配置 Cloudflare 使用 Bun 进行构建的参数，不要修改

```ini
NAME=Xeu # 昵称，显示在左上角
DESCRIPTION=杂食动物 # 个人描述，显示在左上角昵称下方
AVATAR=https://avatars.githubusercontent.com/u/36541432 # 头像地址，显示在左上角
API_URL=https://rin.xeu.life # 服务端域名，可以先使用默认值查看效果，后续部署服务端后再修改
PAGE_SIZE=5 # 默认分页大小，推荐 5
SKIP_DEPENDENCY_INSTALL=true
UNSTABLE_PRE_BUILD=asdf install bun latest && asdf global bun latest && bun i
```

![1000000660](https://github.com/OXeu/Rin/assets/36541432/0fe9276f-e16f-4b8a-87c5-14de582c9a3a)

点击`保存并部署`，等待构建部署，不出意外的话约 30s 后即可部署完成：

![1000000661](https://github.com/OXeu/Rin/assets/36541432/979810b7-3f6f-415b-a8e8-5b08b0da905d)

点击打开即可看见前端页面

![1000000662](https://github.com/OXeu/Rin/assets/36541432/57c61ad6-c324-48e4-a28f-a1708fd7d41a)

前端就全部部署完成啦 🎉

### 故障排除

如遇以下错误，请检查环境变量中是否存在空格等无关内容
```
2024-06-07T02:24:04.979145Z	Using v2 root directory strategy
2024-06-07T02:24:05.003931Z	Success: Finished cloning repository files
2024-06-07T02:24:06.568608Z	Checking for configuration in a wrangler.toml configuration file (BETA)
2024-06-07T02:24:06.56923Z	
2024-06-07T02:24:06.667468Z	No wrangler.toml file found. Continuing.
2024-06-07T02:24:07.542274Z	Failed: an internal error occurred. If this continues, contact support: https://cfl.re/3WgEyrH
```

如错误提示为以下内容，请点击`重试部署`再次尝试：
```
16:30:39.855	Using v2 root directory strategy
16:30:39.881	Success: Finished cloning repository files
16:30:40.746	Failed: unable to read wrangler.toml file with code: -11
16:30:41.587	Failed: an internal error occurred. If this continues, contact support: https://cfl.re/3WgEyrH
```

后续可以在 Pages 的设置中再次修改环境变量以及配置域名

但是现在页面中什么内容也没有，因为我们还没有开始部署后端

## 后端

后端部署比较繁琐，但经过几次的优化部署流程，现在已经大大简化了

### 获取用户 ID 与 API 令牌

参照 https://developers.cloudflare.com/workers/wrangler/ci-cd/ 来配置 GitHub Actions 所需的 Cloudflare 登录环境变量

ID 随意点击一个自己绑定的域名，进入后在右侧（需要向下滑动一段距离）可以找到`账户ID`

创建 API 令牌：点击右上角`头像` > `我的个人资料` > `API 令牌` > `创建令牌`，模板选择`编辑 Cloudflare Workers`：
![1000000663](https://github.com/OXeu/Rin/assets/36541432/3a34a2ad-b993-47fe-965d-31cca4a8e92a)

创建完成后保存令牌

### 配置 GitHub Action

在自己 fork 的仓库中 > `Settings` > `Secrets and Variables` > `Actions` > `Repository secrets` 点击 `New repository secret` 创建以下两个密钥：

```
CLOUDFLARE_ACCOUNT_ID=<你的用户ID>
CLOUDFLARE_API_TOKEN=<你的令牌>
```

同时你可以在`Actions secrets and variables`的 `Variables` 中创建以下变量：

```ini
DB_NAME=<数据库名称，默认rin>
WORKER_NAME=<Cloudflare Worker 名称，默认rin-server>
FRONTEND_URL=<前端地址，用于Webhook通知时拼接地址，可不填>
SEO_BASE_URL=<SEO 基础地址，用于 SEO 索引，默认为 FRONTEND_URL>
SEO_CONTAINS_KEY=<SEO 索引时只索引以 SEO_BASE_URL 开头或包含SEO_CONTAINS_KEY 关键字的链接，默认为空>
S3_FOLDER=<S3 图片资源存储的文件夹，默认为 'images/'>
S3_CACHE_FOLDER=<S3 缓存文件夹（用于 SEO、高频请求缓存），默认为 'cache/'>
S3_BUCKET=<S3 存储桶名称>
S3_REGION=<S3 存储桶所在区域，如使用 Cloudflare R2 填写 auto 即可>
S3_ENDPOINT=<S3 存储桶接入点地址>
S3_ACCESS_HOST=<S3 存储桶访问地址，末尾无'/'>
```

> [!TIP]
> 关于 SEO 工作原理与配置请参考 [SEO 文档](./SEO.md)

完成准备工作以后即可在 GitHub Action 中手动触发一次 Workflow，一切正常的话很快就能部署完成

这样服务端就部署好了，但是目前仍然不能运行，我们还需要配置 GitHub OAuth 用于登录和 S3 存储用于存储图片

> [!TIP]
> 在 v0.2.0 版本后，不再需要回到 Cloudflare 面板配置后端域名与一些敏感的环境变量，所有环境变量都可以通过 GitHub 创建对应的密钥来添加，如果你在更早的版本中部署过，需要将环境变量迁移到 GitHub 中

> ~~回到 Cloudflare 面板配置后端域名与一些敏感的环境变量~~
>
> ~~在 `设置` > `触发器` > `自定义域` 处可以自定义后端的域名，默认也有分配一个`workers.dev`的域名~~
>
> ~~在 `设置` > `变量` > `环境变量` 处编辑变量，点击添加变量，复制粘贴以下内容至变量名处即可自动添加上所有环境变量，之后再根据自己的具体配置修改变量值：~~
> 在 v0.2.0 版本后，以下所有环境变量都建议通过在 GitHub 创建对应的密钥来添加，添加方式与上文添加 `CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN` 相同，以下是环境变量列表：

```ini
RIN_GITHUB_CLIENT_ID=<你的GithubClientID>
RIN_GITHUB_CLIENT_SECRET=<你的GithubClientSecret>
JWT_SECRET=<JWT 认证所需密钥，可为常规格式的任意密码>
S3_ACCESS_KEY_ID=<你的S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<你的S3SecretAccessKey>
```

## 接入 GitHub OAuth

打开 <https://github.com/settings/developers>，选择 `New OAuth App` 创建一个新的 Oauth App，填入自己的应用名称与主页地址(带`http://`或`https://`)，`Authorization callback URL` 填写

```
https://<你的后端地址>/user/github/callback
```

这里附上我的参数
![GitHub OAuth 配置](https://github.com/OXeu/Rin/assets/36541432/74ab8d16-93ca-4919-beec-4beb7a2003a6)

随后配置环境变量中 OAuth 部分

以下是具体的配置，`RIN_GITHUB_CLIENT_ID`填写 GitHub OAuth App 中的`Client ID`,`RIN_GITHUB_CLIENT_SECRET`填写在 GitHub OAuth App 点击 `Generate a new client secret` 后的 `Client secret`，注意每次创建后只展示一次，后续无法查看，如果不慎丢失重新生成一个新的即可

## 创建 R2 桶

理论上支持任意遵循 S3 协议的对象存储服务，这里只介绍接入 Cloudflare R2 的操作

Cloudflare 面板中点击 `R2` > `创建存储桶`，填写名称，选择距离自己近的位置：
![1000000665](https://github.com/OXeu/Rin/assets/36541432/17c5ad7b-8a3a-49b2-845a-8d043484aa63)

创建存储桶之后进入存储桶详情页 > `设置`，复制 S3 API 地址，去除末尾的存储桶名称后填入 `S3_ENDPOINT`，如：

```ini
S3_BUCKET=image # 桶名称
S3_REGION=auto # 地区 auto 不用修改
S3_ENDPOINT=https://8879900e5e1219fb745c9f69b086565a.r2.cloudflarestorage.com
```

然后在`公开访问`处绑定一个域名用于访问资源，绑定的域名对应于`S3_ACCESS_HOST`环境变量：

```ini
S3_ACCESS_HOST=https://image.xeu.life
```

然后创建一个 API 令牌用于访问存储桶，可参考 https://developers.cloudflare.com/r2/api/s3/tokens/ ，这里不再赘述，拿到 ID 和 TOKEN 对应于`S3_ACCESS_KEY_ID` 和 `S3_SECRET_ACCESS_KEY` 变量，填入 Workers 的环境变量中

至此后端就已经部署完成了，记得将前端的 API_URL 修改为后端的地址，与此同时，如果你需要 WebHook 通知的话，还可在后端配置环境变量`WEBHOOK_URL`为你的 Webhook 地址，在新增评论时会像目标 URL 发送一条 POST 消息，消息格式为：

```json
{
  "content": "消息内容"
}
```

> [!TIP]
> 在所有环境变量调试完毕后可点击加密按钮加密环境变量（只保留 FRONTEND_URL 和 S3_FOLDER），这样下次部署时加密的环境变量就不会覆盖/删除了

# 操作视频
由于时间原因未对以下视频做剪辑与后期说明处理，如果对于部署流程不了解或疑惑可参考视频步骤


https://github.com/OXeu/Rin/assets/36541432/3ed98e93-2cc3-4e5f-a885-4d16a48500c3


