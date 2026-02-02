# Rin 文档

本文档站点使用 [Rspress](https://rspress.dev/) 构建。

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun dev

# 构建
bun build

# 预览构建结果
bun preview
```

## 目录结构

```
docs/
├── docs/                 # 文档内容
│   ├── zh/              # 中文文档
│   │   ├── guide/       # 指南
│   │   │   ├── index.md # 简介
│   │   │   ├── deploy.mdx # 部署指南
│   │   │   ├── seo.md   # SEO 配置
│   │   │   ├── rss.md   # RSS 配置
│   │   │   ├── changelog.md # 更新日志
│   │   │   └── contribution.md # 贡献指南
│   │   ├── _meta.json   # 中文导航配置
│   │   └── env.md       # 环境变量
│   ├── en/              # 英文文档
│   │   └── ...          # 同上
│   ├── index.md         # 首页
│   └── public/          # 静态资源
├── package.json         # 依赖配置
├── rspress.config.ts    # Rspress 配置
└── tsconfig.json        # TypeScript 配置
```

## 文档同步

本文档与主仓库中的文档保持同步：
- `docs/docs/zh/guide/deploy.mdx` ↔ `DEPLOY.md`
- `docs/docs/zh/env.md` ↔ `ENV.md`
- `docs/docs/zh/guide/seo.md` ↔ `SEO.md`
- `docs/docs/zh/guide/rss.md` ↔ `RSS.md`
- `docs/docs/zh/guide/contribution.md` ↔ `CONTRIBUTING_zh_CN.md`

修改时请同时更新两个位置的文档以确保一致性。
