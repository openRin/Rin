# 发布流程

本文档描述了 Rin 项目的发布流程。

## 概述

Rin 使用[语义化版本控制](https://semver.org/lang/zh-CN/)，并遵循结构化的发布工作流以确保稳定性和一致性。

**主要特性：**
- 🤖 **自动生成发布说明**：从常规提交信息生成
- 📝 **详细的变更日志**：在 `CHANGELOG.md` 中维护，包含迁移指南
- ✅ **自动验证**：CI 检查版本一致性并运行测试
- 🚀 **自动部署**：在版本标签上部署到 Cloudflare

## 版本格式

版本遵循 `MAJOR.MINOR.PATCH` 格式：

- **MAJOR**：不兼容的 API 变更
- **MINOR**：新功能（向后兼容）
- **PATCH**：Bug 修复（向后兼容）

预发布版本可以用连字符标记，例如 `v1.0.0-beta.1`。

## 提交信息规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范。这使我们能够自动生成发布说明。

### 快速参考

| 类型 | 描述 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): 添加 GitHub OAuth` |
| `fix` | Bug 修复 | `fix(api): 解决 CORS 问题` |
| `docs` | 文档 | `docs(readme): 更新指南` |
| `refactor` | 代码重构 | `refactor(db): 优化查询` |
| `perf` | 性能优化 | `perf(cache): 添加 Redis` |
| `chore` | 维护 | `chore(deps): 更新包` |

更多详情，请参考[提交规范](./commit-convention.md)。

## 发布工作流

### 1. 确保所有变更已就绪

- [ ] 所有功能/修复已合并到 `main`
- [ ] 所有提交遵循[常规提交格式](./commit-convention.md)
- [ ] 测试通过（`bun run check`、`bun run build`）

### 2. 运行发布脚本

```bash
# 升级补丁版本（0.1.0 -> 0.1.1）
bun scripts/release.ts patch

# 升级次要版本（0.1.0 -> 0.2.0）
bun scripts/release.ts minor

# 升级主要版本（0.1.0 -> 1.0.0）
bun scripts/release.ts major

# 或设置特定版本
bun scripts/release.ts 1.2.3
```

脚本将：
1. ✅ 运行发布前检查（typecheck、build、版本一致性）
2. 📝 更新所有 `package.json` 文件中的版本
3. 📝 生成包含提交列表的 CHANGELOG.md 模板
4. 🏷️ 创建 git 提交和标签

**重要**：脚本会生成一个 CHANGELOG 模板。您应该在推送前审查和编辑它！

### 3. 审查和编辑 CHANGELOG

运行发布脚本后：

```bash
# 打开 CHANGELOG.md 并编辑新版本部分
# 添加详细描述、迁移指南等
nano CHANGELOG.md  # 或使用您喜欢的编辑器

# 如果您做了更改，修改提交
git add CHANGELOG.md
git commit --amend --no-edit
```

### 4. 试运行（可选）

要在不应用更改的情况下预览：

```bash
bun scripts/release.ts minor --dry-run
```

### 5. 推送发布

```bash
# 推送提交
git push origin main

# 推送标签（触发发布工作流）
git push origin v0.2.0
```

### 6. 自动发布流程

一旦标签被推送，GitHub Actions 会自动：

1. **🔍 验证**（`release.yml`）
   - 验证版本一致性
   - 运行 typecheck 和 build

2. **📝 发布说明生成**（`release.yml`）
   - 按类型分类提交（功能、修复等）
   - 从 CHANGELOG.md 提取详细说明
   - 创建格式化的 GitHub Release

3. **🚀 部署**（`deploy.yml`）
   - 验证部署版本
   - 部署到 Cloudflare Workers
   - 运行数据库迁移

## 发布说明结构

GitHub Releases 将包含：

```markdown
## 变更内容

**完整变更日志**：v0.1.0...v0.2.0

### 🚀 功能
- feat(auth): 添加 GitHub OAuth 登录 (abc1234)
- feat(ui): 实现暗黑模式 (def5678)

### 🐛 Bug 修复
- fix(api): 解决 CORS 问题 (ghi9012)

### 📋 详细变更日志
[此版本的 CHANGELOG.md 内容]

---

## 🆙 升级指南
...
```

## 对于 Fork 用户

### 选项 1：同步 Fork（推荐）

1. 转到您在 GitHub 上的 fork 仓库
2. 点击 **"Sync fork"** 按钮
3. 查看 [CHANGELOG.md](./changelog.md) 了解迁移步骤
4. 如果需要，更新环境变量
5. 如果已配置，部署将自动运行

### 选项 2：手动更新

```bash
# 添加上游远程
git remote add upstream https://github.com/openRin/Rin.git

# 获取最新更改
git fetch upstream

# 合并到您的 main 分支
git checkout main
git merge upstream/main

# 推送到您的 fork
git push origin main
```

## 发布检查清单

在创建发布之前：

- [ ] 所有测试通过（`bun run check`、`bun run build`）
- [ ] 所有提交遵循常规格式
- [ ] CHANGELOG.md 模板已生成并编辑
- [ ] 包含迁移指南（用于破坏性变更）
- [ ] 文档已更新（如果需要）

推送标签后：

- [ ] GitHub Release 成功创建
- [ ] 发布说明看起来正确
- [ ] 部署成功完成

## 紧急发布

对于需要立即发布的严重 Bug：

```bash
# 从最新标签创建热修复分支
git checkout -b fix/critical-bug v0.2.0

# 应用修复并使用常规格式提交
git commit -m "fix(api): 解决严重安全问题"

# 运行发布脚本
bun scripts/release.ts patch

# 推送（热修复不需要合并到 main）
git push origin fix/critical-bug
git push origin v0.2.1
```

## 故障排除

### 版本不匹配错误

**问题**：CI 显示"版本不匹配"错误

**解决方案**：
1. 确保 git 标签与 `package.json` 版本匹配
2. 发布脚本会自动处理
3. 对于手动发布，确保：`git tag v1.0.0` 与 package.json 中的 `"version": "1.0.0"` 匹配

### 空的发布说明

**问题**：GitHub Release 没有列出变更

**解决方案**：
1. 确保提交遵循常规格式（`feat:`、`fix:` 等）
2. 检查标签之间是否存在提交：`git log v0.1.0..v0.2.0 --oneline`
3. 非常规提交不会出现在分类列表中

### 部署失败

**问题**：发布后部署失败

**解决方案**：
1. 检查 GitHub Actions 日志以获取特定错误
2. 验证所有必需的 secrets 已配置
3. 检查 Cloudflare 仪表板以获取部署错误
4. 如果需要，从 Actions 选项卡手动触发部署

### CHANGELOG.md 冲突

**问题**：CHANGELOG.md 中的合并冲突

**解决方案**：
1. 保留两个部分
2. 按时间顺序重新排列（最新的在前）
3. 删除重复条目

## 最佳实践

### 编写好的提交

✅ **好的**：
```
feat(auth): 实现 JWT 令牌刷新

添加自动令牌刷新以防止会话超时。
令牌在过期前 5 分钟刷新。

Closes #123
```

❌ **不好的**：
```
update auth stuff
fixed bug
```

### 维护 CHANGELOG

- 在开发期间保持 [Unreleased] 部分更新
- 为破坏性变更编写迁移指南
- 在迁移部分包含代码示例
- 适当时致谢贡献者

### 版本升级

- **Patch** (0.0.1)：仅 Bug 修复
- **Minor** (0.1.0)：新功能，向后兼容
- **Major** (1.0.0)：破坏性变更

不确定时，对新功能使用 **minor**。

## 有问题？

- 📖 阅读[提交规范](./commit-convention.md)了解提交指南
- 🐛 报告问题：[GitHub Issues](https://github.com/openRin/Rin/issues)
- 💬 加入我们的社区讨论
