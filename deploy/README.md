<!--
 * @Author: Bin
 * @Date: 2026-01-11
 * @FilePath: /Rin/deploy/README.md
-->

# 使用 Docker 运行 Rin

1、首先 clone 代码仓库 `git clone https://github.com/openRin/Rin.git`

2、参考文档 [环境变量列表](../docs/ENV.md) 创建并配置文件 `.dev.vars` 和 `wrangler.toml`

```bash
# 构建 image
docker build . -f ./deploy/Dockerfile -t rinapp

# 启动服务
docker run -d \
  -p 11498:11498 \
  -p 5173:5173 \
  -v .dev.vars:/app/.dev.vars \
  -v ./wrangler.toml:/app/wrangler.toml \
  -v ./data/wrangler:/app/.wrangler \
  rinapp:latest
```

> `http://127.0.0.1:11498` 为部署的后端地址，`http://127.0.0.1:5173` 为部署的前端地址。数据存储目录为 `./data` 文件夹。可根据自己需求调整 docker 运行参数。
