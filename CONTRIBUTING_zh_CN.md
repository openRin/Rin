# 为 Rin 做贡献

[English](./CONTRIBUTING.md) | 简体中文

我们很乐意接受您对这个项目的补丁和贡献。您只需遵循一些小指南即可。

# Commit-msg 钩子
我们在 scripts/commit-msg.sh 中有一个示例 commit-msg hook。请运行以下命令设置：

```sh
ln -s ../../scripts/commit-msg.sh commit-msg
```

这将在每次提交之前运行以下检查：

1. `tsc` 检查前端代码是否存在语法错误与未使用变量与引用
2. 检查提交消息是否以以下之一开头：feat|chore|fix|docs|ci|style|test|pref

如果您想跳过钩子，请使用 `--no-verify` 选项运行 `git commit`。

# 设置开发环境

1. Fork & Clone 仓库

2. 安装 [Node](https://nodejs.org/en/download/package-manager) & [Bun](https://bun.sh/)

3. 安装依赖项
```sh
bun i
```

1. 将 `wrangler.example.toml` 文件复制到 `wrangler.toml` 并填写必要信息

2. 将 `client/.env.example` 文件复制到 `client/.env` 并填写必要信息

3. 启动开发服务器
```sh
bun dev
```

1. 为了更好地控制开发服务器，您可以分别在客户端目录和服务器目录中运行 dev 命令：
```sh
# tty1
cd client
bun dev

# tty2
cd server
bun dev
```

# 提交更改

1. 对于简单的补丁，只需一分钟即可有人对其进行审核。

2. 在 PR 准备好进行审核后，不要强制推送小的更改。这样做会迫使维护者重新阅读您的整个 PR，从而延迟审核过程。

3. 始终保持 CI 为绿色。

4. 如果 CI 在您的 PR 上失败，请不要推送。即使您认为这不是补丁的错误。如果其他原因破坏了 CI，请在推送之前帮助修复根本原因。

*开始愉快的写代码吧！*

# 代码审核
所有提交，包括项目成员的提交，都需要审核。我们使用 GitHub 拉取请求来实现此目的。有关使用拉取请求的更多信息，请参阅 GitHub 帮助。