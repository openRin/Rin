# Rin 迁移指南 (v0.3.0)

本指南帮助现有 Rin 用户迁移到最新版本。

## 变更概览

v0.3.0 版本包含重大的架构变更：

1. **框架迁移**: 用自定义轻量级框架替代 ElysiaJS
2. **API 变更**: 新的 API 客户端接口
3. **登录方式**: 新增账号密码登录支持
4. **OAuth 变更**: GitHub OAuth 变量名更新
5. **性能提升**: 显著的性能改进

## 迁移步骤

### 第一步：同步 Fork

1. 进入您在 GitHub 上 fork 的仓库
2. 点击 **"Sync fork"** 按钮
3. 点击 **"Update branch"** 合并变更

### 第二步：更新环境变量

#### 必需变更

**GitHub OAuth 变量（如果使用 GitHub 登录）**

旧变量名已弃用：

```
GITHUB_CLIENT_ID      → RIN_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET  → RIN_GITHUB_CLIENT_SECRET
```

**操作步骤**：
1. 进入 Settings → Secrets and variables → Actions
2. 添加带 `RIN_` 前缀的新 Secrets
3. （可选）删除旧 Secrets

#### 可选：添加账号密码登录

如果您更喜欢简单的账号密码登录而非 GitHub OAuth：

1. 添加以下 Secrets：
   - `ADMIN_USERNAME`: 您想要的用户名
   - `ADMIN_PASSWORD`: 您想要的密码

### 第三步：移除 Pages（可选但推荐）

自 0.3.0 开始，Rin 改为使用 Workers 托管静态资源，不再依赖 Cloudflare Pages。建议按以下步骤迁移：

1. **解绑 Pages 域名**
   - 进入 Cloudflare Dashboard → Pages
   - 选择您的 Pages 项目 → 自定义域
   - 删除绑定的域名

2. **将域名绑定到 Worker**
   - 进入 Cloudflare Dashboard → Workers & Pages
   - 选择您的 Worker (`rin-server`)
   - 点击"触发器" → "添加自定义域"
   - 输入您的域名并保存

3. **清理多余的域名绑定**
   - 检查 Worker 的自定义域列表
   - 删除不需要的绑定（如 `seo/*`、`sub/*` 等）

4. **更新 GitHub OAuth Callback**
   - 进入 GitHub → Settings → Developer settings → OAuth Apps
   - 找到您的 OAuth App
   - 将 Authorization callback URL 从：
     - `https://<worker-domain>/user/github/callback`
   - 修改为：
     - `https://<your-domain>/api/user/github/callback`

### 第四步：更新 Cloudflare API Key 权限

确保您的 Cloudflare API Token 具有以下权限：
- **Cloudflare Workers**:Edit
- **Account**:Read
- **D1**:Edit
- **R2**:Edit (如果使用 R2 存储)

![1000000663](/cloudflare-api-key-cn.png)


### 第五步：部署

1. 进入仓库的 Actions 标签
2. 选择 **"Deploy"** 工作流
3. 点击 **"Run workflow"**

### 第六步：验证部署

1. 访问您的前端 URL
2. 测试登录功能
3. 检查现有文章是否可访问
4. 验证图片是否正确加载

## 破坏性变更汇总

### API 客户端接口

**旧代码**（不再支持）：
```typescript
const feeds = await client.feed.index.get({ query: { page: 1 } });
```

**新代码**：
```typescript
const feeds = await client.feed.list({ page: 1 });
```

如果您有使用旧 API 的自定义前端代码，请相应更新。

### 认证流程

- **旧**: 后端重定向到前端 callback URL
- **新**: 独立的 `/login` 页面，专用登录流程

### 环境变量变化

| 旧名称 | 新名称 | 必需 |
|--------|--------|------|
| `GITHUB_CLIENT_ID` | `RIN_GITHUB_CLIENT_ID` | 可选* |
| `GITHUB_CLIENT_SECRET` | `RIN_GITHUB_CLIENT_SECRET` | 可选* |
| - | `ADMIN_USERNAME` | 可选* |
| - | `ADMIN_PASSWORD` | 可选* |

*必须配置至少一种登录方式

## 迁移后

### 尝试新功能

1. **个人资料管理**: 访问 `/profile` 更新头像和用户名
2. **性能提升**: 体验更快的冷启动和更低的 CPU 使用率
3. **更好的登录体验**: 新的独立登录页面，改进焦点处理

### 清理（可选）

成功迁移后，您可以：

1. 删除已弃用的环境变量
2. 如不再需要，删除旧的预览部署
3. 更新自定义脚本以使用新的 API 接口

## 故障排除

### "版本不匹配" 错误

**解决方案**: 确保 git 标签与 package.json 版本匹配。同步应该会自动处理。

### "无法登录"

**解决方案**：
1. 验证至少配置了一种登录方式（GitHub OAuth 或 账号密码）
2. 检查 Secrets 是否正确设置
3. 尝试清除浏览器缓存

### "图片无法加载"

**解决方案**：
1. 检查 S3/R2 配置
2. 验证 `S3_ACCESS_HOST` 是否正确设置
3. 检查 R2 存储桶权限

## 回滚（如需要）

如果迁移失败需要回滚：

1. 恢复之前的 git 标签：`git checkout v0.2.x`
2. 强制推送到 main（⚠️ 破坏性）：`git push origin HEAD:main --force`
3. 从 Actions 重新部署

## 需要帮助？

- 📖 [完整文档](https://rin-docs.xeu.life)
- 🐛 [GitHub Issues](https://github.com/openRin/Rin/issues)
- 💬 [GitHub Discussions](https://github.com/openRin/Rin/discussions)

---

*最后更新：2025-02-08*
