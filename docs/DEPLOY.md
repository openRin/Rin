# 部署

项目目前处于开发阶段，文档可能未及时更新或存在描述不清，如遇部署失败请提 [Issue](https://github.com/openRin/Rin/issues/new?assignees=&labels=help+wanted&projects=&template=need-help.md&title=%5BHelp%5D+%E9%97%AE%E9%A2%98%E6%8F%8F%E8%BF%B0)

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
>
> 需提前将域名绑定到 Cloudflare；
> 假设前端域名:`xeu.life` 后端域名：`https://rin.xeu.life` 

## Fork
打开仓库页面：https://github.com/openRin/Rin
点击 Fork 按钮 Fork 出一个新仓库

![1000000657](https://github.com/openRin/Rin/assets/36541432/df3607ca-a8a9-49b8-92ce-6b348afeb13f)

## 前端

> [!TIP]
> 先简单介绍一下前端与后端的关系，前端是一个静态页面，托管于 Cloudflare Pages上，前端本质上只是一堆不会变化的文件和代码，并没有你的文章数据之类的内容，想要实现如登录，写文章，评论，获取文章列表和内容、评论列表等逻辑还需要与后端进行数据交换；
> 
> 后端负责处理具体的逻辑，在本项目中后端运行在 Cloudflare Workers 上，前端通过 API 与后端通信，后端通过 Cloudflare D1 保存文章等数据，通过 Cloudflare R2 存储文章中的图片
> 
> 下文提到的前端与后端你可以分别等价代换为 Cloudflare Pages 与 Cloudflare Workers，当提到说需要前端地址或者后端地址时，即为 Cloudflare Pages 地址或 Cloudflare Workers 地址，你可以在 Cloudflare 控制面板中通过少量的操作找到这两个地址，如下面的截图所示：
> 前端（Pages）的地址在 `Workers 和 Pages` > 你的 Pages 项目 > `部署` 中可以找到：
> ![图片](https://github.com/openRin/Rin/assets/36541432/d9dcc5f2-6930-4487-af4b-0ab52e948114)
> 图中的`rin-6qe.pages.dev`,`direct.xeu.life` 都是前端地址，如果有更多的地址，你还可以点击形如 `+2 个域` 的链接查看更多的地址，这些地址都是可以访问的，你可以使用其中任意一个地址，但是需要保持不同地方都填写的是同一个前端地址（如果有多个环境变量要求填写前端地址的话），通常来说前端地址是 `https://rin-6qe.pages.dev` 或 `https://direct.xeu.life` 这样的形式
>
> 后端（Workers）的地址在 `Workers 和 Pages` > 你的 Workers 项目 > `设置` >~~`触发器`~~`域和路由`中可以找到：
> ![图片](https://github.com/openRin/Rin/assets/36541432/0a2385b7-94db-4469-bef9-399cc334f1b6)
> 图中的 `rin.xeu.life` 和 `rin-server.xeu.workers.dev` 都是后端地址，前者是自定义域名，后者是默认分配的域名，你可以使用默认分配的域名，也可以自定义域名，自定义域名需要在 Cloudflare 控制面板中进行配置，在本文档中当要求填写后端地址时，你可以填写形如 `https://rin.xeu.life` 或 `https://rin-server.xeu.workers.dev`的地址，但需保持不同地方都填写的是同一个后端地址（如果有多个环境变量要求填写后端地址的话）

### 创建 Pages 项目
登陆[Cloudflare](https://dash.cloudflare.com/login)控制台，依次进入：`计算（Workers）`>`Workers和Pages`>`Pages`>`连接到 Git`>`连接到 GitHub`，跳转授权页面，`Only select repositories`选择刚刚 Fork 仓库的项目，随后`Install & Authorize`。跳转到：

![1000000666](https://github.com/openRin/Rin/assets/36541432/e3b6da75-1a5f-46ec-9820-636cc5238023)

再次选中 Fork 的`Rin`存储库，点击`开始设置`。

`项目名称`根据喜好设置名称，同时会在下方显示可用域名，比如`您的项目将被部署到 xue-575.pages.dev。`

构建设置：
```
框架预设：无
构建命令：bun b
构建输出目录：client/dist
```

![1000000659](https://github.com/openRin/Rin/assets/36541432/98fb3021-932b-4bfa-8118-3378f98ff628)

环境变量：

> [!IMPORTANT]
> 最后两行环境变量 `SKIP_DEPENDENCY_INSTALL` 和 `UNSTABLE_PRE_BUILD` 为配置 Cloudflare 使用 Bun 进行构建的参数，禁止修改。

```ini
NAME=Xeu # 昵称，显示在左上角
DESCRIPTION=杂食动物 # 个人描述，显示在左上角昵称下方
AVATAR=https://avatars.githubusercontent.com/u/36541432 # 头像地址，显示在左上角
API_URL=https://rin.xeu.life # 自定义后端域名
PAGE_SIZE=5 # 默认分页大小，推荐 5
SKIP_DEPENDENCY_INSTALL=true
UNSTABLE_PRE_BUILD=asdf install bun latest && asdf global bun latest && bun i
```

![1000000660](https://github.com/openRin/Rin/assets/36541432/0fe9276f-e16f-4b8a-87c5-14de582c9a3a)

点击`保存并部署`，等待构建部署，不出意外的话约1分钟后即可部署完成：

![1000000661](https://github.com/openRin/Rin/assets/36541432/979810b7-3f6f-415b-a8e8-5b08b0da905d)

点击打开即可看见前端页面

![1000000662](https://github.com/openRin/Rin/assets/36541432/57c61ad6-c324-48e4-a28f-a1708fd7d41a)

前端就全部部署完成啦 🎉

### 故障排除

如遇以下错误，请检查环境变量中是否存在空格等无关内容
```
02:24:04.979145Z	Using v2 root directory strategy
02:24:05.003931Z	Success: Finished cloning repository files
02:24:06.568608Z	Checking for configuration in a wrangler.toml configuration file (BETA)
02:24:06.56923Z	
02:24:06.667468Z	No wrangler.toml file found. Continuing.
02:24:07.542274Z	Failed: an internal error occurred. If this continues, contact support: https://cfl.re/3WgEyrH
```

如错误提示为以下内容，请点击`重试部署`再次尝试：
```
16:30:39.855	Using v2 root directory strategy
16:30:39.881	Success: Finished cloning repository files
16:30:40.746	Failed: unable to read wrangler.toml file with code: -11
16:30:41.587	Failed: an internal error occurred. If this continues, contact support: https://cfl.re/3WgEyrH
```

## 后端

后端部署比较繁琐，但经过几次的优化部署流程，现在已经大大简化了

### 获取帐户 ID、用户 API 令牌
 > 参照 https://developers.cloudflare.com/workers/wrangler/ci-cd/ 配置 GitHub Actions 所需的 Cloudflare 登录环境变量

#### 获取帐户 ID
[Cloudflare](https://dash.cloudflare.com/)控制台，浏览器地址栏链接`https://dash.cloudflare.com/9999ef34fce71119da637fa4b0c459a1/`，其中的`9999ef34fce71119da637fa4b0c459a1`是帐户 ID。

#### 获取 API 令牌
前往[用户 API 令牌](https://dash.cloudflare.com/profile/api-tokens)，依次进入：`创建令牌`>`创建自定义令牌`>`开始使用`：
填写`令牌名称`、增加三个`权限`项目、`TTL`设置API生命周期。PS：时长太短会导致需手动再次更新 API 令牌。

![1000000663](https://github.com/openRin/Rin/assets/36541432/3a34a2ad-b993-47fe-965d-31cca4a8e92a)

填写完成，点击`继续以显示摘要`，会再次确认填写有误：
```
Rin API 令牌摘要
此 API 令牌将影响以下帐户和区域，以及它们各自的权限
所有帐户 - Workers 脚本:编辑, Workers R2 存储:编辑, D1:编辑
TTL
开始日期 - 2025年2月9日
结束日期 - 2025年2月17日
```
再次点击`创建令牌`，就能获取到 API 令牌。

#### 获得：
```
CLOUDFLARE_ACCOUNT_ID=9999ef34fce71119da637fa4b0c459a1 # 帐户 ID
CLOUDFLARE_API_TOKEN=Be9GL-ptZ7ElWnl6vffPhbCRoFSfgQDAwFPT7Uln # API 令牌
```

### R2 对象存储
#### 创建 R2
[Cloudflare](https://dash.cloudflare.com/)控制台，依次进入：`R2 对象存储`>`创建存储桶`，填写名称，选择距离自己近的位置：

![1000000665](https://github.com/openRin/Rin/assets/36541432/17c5ad7b-8a3a-49b2-845a-8d043484aa63)

再次点击`创建存储桶`，随后切换到`设置`页面，`S3 API`的值：`https://9999ef34fce71119da637fa4b0c459a1.r2.cloudflarestorage.com/image`

继续往下在`公开访问`绑定自定义二级域名，举例：`https://image.xeu.life`

#### 获取 R2 API 令牌
创建 API 令牌用于访问存储桶。
前往[API 令牌](https://dash.cloudflare.com/?to=/:account/r2/api-tokens)，`创建 API 令牌`>`权限`>`管理员读和写`>`创建 API 令牌`，记录`访问密钥 ID`、`机密访问密钥`的值。

#### 获得
```
```ini
S3_BUCKET=image # 桶名称
S3_REGION=auto # 地区 auto 不用修改
S3_ENDPOINT=https://9999ef34fce71119da637fa4b0c459a1.r2.cloudflarestorage.com # S3 API 地址
S3_ACCESS_HOST=https://image.xeu.life # 自定义域名
S3_ACCESS_KEY_ID=64699d73ed99d0553e7a0ff0d54e59c2 # 访问密钥 ID
S3_SECRET_ACCESS_KEY=9b21d9830b88df0492990dc4c7dfc19f3d157f702fdc78e5ec99e4407556fe0b # 机密访问密钥
```

## 接入 GitHub OAuth

打开 <https://github.com/settings/developers>，选择 `New OAuth App` 创建一个新的 Oauth App，填入自己的应用名称与主页地址(带`http://`或`https://`)，`Authorization callback URL` 填写

```
https://<你的后端地址>/user/github/callback
```
![GitHub OAuth 配置](https://github.com/openRin/Rin/assets/36541432/74ab8d16-93ca-4919-beec-4beb7a2003a6)

例如：
```
Application name：Rin
Homepage URL：https://xeu.life # 前端域名
Authorization callback URL：https://rin.xeu.life/user/github/callback # 后端域名
```

填写完成后依次点击` Register application `>`Generate a new client secret`，分别得到了`Client ID`、`Client secrets`值。
注意每次创建后只展示一次，后续无法查看，如果不慎丢失重新生成一个新的即可。

#### 获得
```
RIN_GITHUB_CLIENT_ID=Ov99lijHWujAkdg0HSbC # Client ID
RIN_GITHUB_CLIENT_SECRET=cbb5bbb5bce9c7e57738e928198adff51f999ca4 # Client secrets
```

### 配置 GitHub Action
> [!TIP]
> 在 v0.2.0 版本后，不再需要回到 Cloudflare 面板配置后端域名与一些敏感的环境变量，所有环境变量都可以通过 GitHub 创建对应的密钥来添加，如果你在更早的版本中部署过，需要将环境变量迁移到 GitHub 中。

在自己 Fork 的仓库中 > `Settings` > `Secrets and Variables` > `Actions` > `Repository secrets` 点击 `New repository secret` ，根据上面的操作得到的数据依次按下面表格添加：

```
CLOUDFLARE_ACCOUNT_ID=<你的用户ID>
CLOUDFLARE_API_TOKEN=<你的令牌>
RIN_GITHUB_CLIENT_ID=<你的GithubClientID>
RIN_GITHUB_CLIENT_SECRET=<你的GithubClientSecret>
JWT_SECRET=<JWT 认证所需密钥，可为常规格式的任意密码>
S3_ACCESS_KEY_ID=<你的S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<你的S3SecretAccessKey>
```

同时你可以在`Actions secrets and variables`> `Variables`> `Repository secrets`中创建以下变量：

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

如果你需要 WebHook 通知的话，还可在后端配置环境变量`WEBHOOK_URL`为你的 Webhook 地址，在新增评论时会像目标 URL 发送一条 POST 消息，消息格式为：

```json
{
  "content": "消息内容"
}
```

### 启动后端
前往 Fork 的 Rin 项目仓库，依次：`Actions`>`I understand my workflows, go ahead and enable them`>`Deploy`>`Run workflow`即可触发部署服务。

#### 前后端绑定自定义域名：

前端`Pages`域名：[Cloudflare](https://dash.cloudflare.com/)控制台，依次进入：`计算（Workers）`>`Workers和Pages`>你的 Pages 项目>`设置`>`域和路由`>`自定义域`

后端`Workers`绑定域名：[Cloudflare](https://dash.cloudflare.com/)控制台，依次进入：`计算（Workers）`>`Workers和Pages`>你的 Workers 项目>`设置`>`域和路由`>`自定义域`

完成绑定，可以通过自定义域名访问测试了。

> [!TIP]
> ~~调试完毕后可点击加密按钮加密环境变量（只保留 FRONTEND_URL 和 S3_FOLDER），下次部署时加密的环境变量就会跳过。~~
> ~~依次进入：`计算（Workers）`>`Workers和Pages`>`rin-server`>`设置`>`域和路由`>`自定义域`>`变量和机密`>`编辑`~~

> [!TIP]
> 关于 SEO 工作原理与配置请参考 [SEO 文档](./SEO.md)

## 迁移指南

无特别说明时正常的版本更新直接同步 Fork 的仓库即可

###  旧版本迁移v0.2.0新版本指南

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

以上环境变量在旧版本中是通过 Cloudflare 面板配置的，现在需要迁移到 GitHub 中配置，新版本的部署 GitHub Action 会自动其上传到 Cloudflare，之后就不再需要在 Cloudflare 面板中配置这些环境变量了


# 操作视频
由于时间原因未对以下视频做剪辑与后期说明处理，如果对于部署流程不了解或疑惑可参考视频步骤


https://github.com/openRin/Rin/assets/36541432/3ed98e93-2cc3-4e5f-a885-4d16a48500c3
