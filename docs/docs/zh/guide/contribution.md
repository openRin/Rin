# 贡献

我们很乐意接受您对这个项目的补丁和贡献。您只需遵循一些小指南即可。

## Commit-msg 钩子

我们在 `scripts/commit-msg.sh` 中有一个示例 commit-msg hook。请运行以下命令设置：

```sh
ln -s ../../scripts/commit-msg.sh ./.git/hooks/commit-msg
```

Windows 下请直接将 `commit-msg.sh` 文件复制到 `.git/hooks/commit-msg`。

```powershell
cp .\scripts\commit-msg.sh .\.git\hooks\commit-msg
```

这将在每次提交之前运行以下检查：

1. **类型检查** - `bun run check` 验证所有包的 TypeScript 类型
2. **代码格式化** - 检查代码格式和风格
3. **提交消息格式** - 验证提交消息是否以以下之一开头：`feat|chore|fix|docs|ci|style|test|pref`

:::warning 重要提示
钩子还会运行测试。提交前请确保所有测试通过：
```sh
bun run test
```
:::

如果您想跳过钩子（不推荐），请使用 `--no-verify` 选项运行 `git commit`。

## 设置开发环境

1. Fork & Clone 仓库

2. 安装 [Node](https://nodejs.org/en/download/package-manager) & [Bun](https://bun.sh/)

3. 安装依赖项
    ```sh
    bun i
    ```

4. 在 `.env.local` 文件中填写必要的配置

:::tip
通常情况下，您只需要填写 `AVATAR`、`NAME` 和 `DESCRIPTION`。
如需配置 GitHub OAuth，需要创建一个 OAuth App，回调地址为 `http://localhost:11498/user/github/callback`
:::

5. 运行设置脚本生成配置文件
```sh
bun run dev:setup
```

这将根据您的 `.env.local` 配置自动生成 `wrangler.toml` 和 `.dev.vars` 文件。

6. 执行数据库迁移
```sh
bun run db:migrate
```

7.（可选）配置 S3/R2 用于图片上传

如需使用图片上传功能，请在 `.env.local` 中填写 S3 配置：
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

8. 启动开发服务器
    ```sh
    bun run dev
    ```

9. 为了更好地控制开发服务器，您可以分别在两个终端中分别运行客户端与服务端的 dev 命令：
    ```sh
    # tty1
    bun run dev:client
    
    # tty2
    bun run dev:server
    ```

## 测试要求

在提交 Pull Request 之前，请确保所有测试通过：

```sh
# 运行所有测试
bun run test

# 运行类型检查
bun run check

# 运行格式化检查
bun run format:check
```

### 为新功能添加测试

添加新的 API 端点时：
1. 在 `packages/api/src/types.ts` 中定义类型（客户端和服务端共享）
2. 在 `server/src/**/__tests__/*.test.ts` 中添加服务端测试
3. 如有需要，在 `client/src/**/__tests__/*.test.ts` 中添加客户端测试

## 提交更改

1. 对于简单的补丁，在 UTC+8 时区的日间通常 10 分钟内即可对其进行审核。

2. 在 PR 准备好进行审核后，不要强制推送小的更改。这样做会迫使维护者重新阅读您的整个 PR，从而延迟审核过程。

3. 始终保持 CI 为绿色。

4. 如果 CI 在您的 PR 上失败，请不要推送。即使您认为这不是补丁的错误。如果其他原因破坏了 CI，请在推送之前帮助修复根本原因。

*开始愉快地写代码吧！*

## 代码审核
所有提交，包括项目成员的提交，都需要审核。我们使用 GitHub 拉取请求来实现此目的。有关使用拉取请求的更多信息，请参阅 GitHub 帮助。