# SEO 工作原理介绍与配置指南
## 前言
由于采用前后端分离的技术，导致搜索引擎无法直接获取到页面内容，因此需要通过 SEO 优化来提高搜索引擎的收录效果。本文将介绍本项目中 SEO 实现的工作原理与配置指南。

## 工作原理
本项目采用的 SEO 优化方案是通过 Github Action进行预渲染，将预渲染后的页面上传到 S3 存储桶，通过 Cloudflare Workers 代理请求，实现 SEO 优化。

预渲染是一个简单的爬虫。从提供的 SEO_BASE_URL 开始，每次请求一个页面，将渲染完成后的 html 内容上传至 S3 存储桶缓存。同时提取出页面中的所有链接，判断是否以 SEO_BASE_URL 开头或包含 SEO_CONTAINS_KEY 关键字，如果是则请求该链接并预渲染，直到没有新的链接为止。

## 配置指南
### 环境变量
在部署后端时，需要在 Github 配置以下环境变量（明文）：
```ini
SEO_BASE_URL=<SEO 基础地址，用于 SEO 索引，默认为 FRONTEND_URL>
SEO_CONTAINS_KEY=<SEO 索引时只索引以 SEO_BASE_URL 开头或包含SEO_CONTAINS_KEY 关键字的链接，默认为空>
S3_FOLDER=<S3 图片资源存储的文件夹，默认为 'images/'>
S3_CACHE_FOLDER=<S3 缓存文件夹（用于 SEO、高频请求缓存），默认为 'cache/'>
S3_BUCKET=<S3 存储桶名称>
S3_REGION=<S3 存储桶所在区域，如使用 Cloudflare R2 填写 auto 即可>
S3_ENDPOINT=<S3 存储桶接入点地址>
S3_ACCESS_HOST=<S3 存储桶访问地址>
```

以及以下环境变量（加密）：
```ini
S3_ACCESS_KEY_ID=<你的S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<你的S3SecretAccessKey>
```

由于这些环境变量数量庞大且覆盖了相当一部分环境变量全列表，因此在 `v0.2.0` 及之后都建议在部署时直接在 Github 中添加这些环境变量，而不是通过 Cloudflare 面板添加。这样能够一定程度上减少配置的时间成本。

### 部署
在配置好环境变量后，即可在 Github Action 中手动触发一次 Workflow，一切正常的话很快就能部署完成。

### 配置 Workers 路由
在 Cloudflare Workers 面板中打开自己的域名详情页，点击 `Workers 路由`，添加一个新路由，路由填写为：
```
<前端域名>/seo/*
```
如：
```
xeu.life/seo/*
```
![图片](https://github.com/openRin/Rin/assets/36541432/ed0ecc72-f61f-4460-8ede-4475ca54ffcb)

Worker 选择为部署的 Worker，点击保存。

随后点击侧边栏菜单 > `规则` > `转换规则` > `重写 URL` > `创建规则`，规则名称随意，自定义筛选表达式为：
> [!NOTE]
> 该筛选表达式只为 Google 做了收录优化，如需其他搜索引擎的优化请自行查找其对应的爬虫 UA 填写
```
(http.host eq "<前端域名，如xeu.life>" and http.user_agent contains "Googlebot")
```
重写路径设置为 `Dynamic`，值为：
```
concat("/seo",http.request.uri.path)
```
选择`保留查询`

参考配置截图：
![转换规则](https://github.com/openRin/Rin/assets/36541432/657e9546-1dc0-4390-9bfc-5d3eb725e792)

点击部署，即可完成 SEO 配置。
