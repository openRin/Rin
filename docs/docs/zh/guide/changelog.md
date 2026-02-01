# 更新日志

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