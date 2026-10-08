# 插件系统

Rin 的插件系统是**编译期内置**的：插件放在 `server/plugins/`，随仓库一起构建。

## 为什么不用运行时动态加载

Worker 环境下动态 import 外部代码无法做类型检查，插件出错要到运行时才暴露。
编译期内置则能在构建期暴露问题。对自用型项目来说，这比生态更重要。

代价是：改插件需要重新部署。但改插件通常伴随改主站，本来就要部署。

## 快速开始

三步接入：

**1. 写插件** — `server/plugins/<name>/index.ts`

```ts
import type { PluginContext, RinPlugin } from '../../src/plugins/types';

const plugin: RinPlugin = {
  manifest: {
    name: 'my-plugin',        // 小写 kebab-case，全局唯一
    displayName: '我的插件',
    version: '1.0.0',
  },

  async setup(ctx: PluginContext) {
    ctx.log.info('插件已加载');
  },

  comment: {
    async beforeCreate(input, ctx) {
      // 返回字符串 = 拒绝本次提交
      if (input.content.includes('广告')) {
        return '评论不能包含广告内容';
      }
    },
  },
};

export default plugin;
```

**2. 注册** — 在 `server/src/plugins/index.ts` 的 `ALL_PLUGINS` 里加一行

```ts
import myPlugin from '../../plugins/my-plugin';

const ALL_PLUGINS: RinPlugin[] = [
  commentGuard,
  myPlugin,   // ← 加这里，数组顺序 = 钩子执行顺序
];
```

**3. 配置** — 在后台「服务器配置」里添加

| 键 | 类型 | 说明 |
|---|---|---|
| `my-plugin.enabled` | boolean | 是否启用 |

## 扩展点

所有钩子都是可选的。插件只声明自己关心的部分，不提供就不会被调用，
也不会有任何运行时开销。

### `comment` — 评论生命周期

| 钩子 | 时机 | 能否拦截 |
|---|---|---|
| `beforeCreate` | 写库前 | 返回非空字符串即拒绝 |
| `afterCreate` | 写库后 | 抛错不影响评论 |
| `beforeDelete` | 删除前 | 抛错不影响删除 |

### `feed` — 文章生命周期

| 钩子 | 时机 | 能否拦截 |
|---|---|---|
| `beforeSave` | 写库前 | 返回非空字符串即拒绝 |
| `afterSave` | 写库后 | 抛错不影响保存 |
| `afterDelete` | 删除后 | 抛错不影响删除 |

### `routes` — 自定义 API 端点

挂载到 `/plugins/<插件名>/` 下。

```ts
routes(app) {
  // 插件自行决定鉴权。公开信息就不校验，需要登录就检查 c.get('uid')。
  app.get('/status', (c) => c.json({ ok: true }));
}
```

> 插件路由挂载在**所有内置路由之后**，避免意外覆盖既有端点。
> 但也意味着插件不能用 `/plugins/x` 之外的路径提供服务。

### `setup` — 启动初始化

应用启动时执行一次。抛错会让该插件被标记为 `error` 并跳过，
**不影响其他插件**。

## 插件上下文（`PluginContext`）

```ts
{
  db,            // Drizzle 数据库，完全访问
  cache,         // 通用缓存
  serverConfig,  // 服务端配置
  clientConfig,  // 客户端配置
  env,           // 环境变量
  request?,      // 当前请求；setup 阶段为 undefined
  log,           // 带插件名前缀的 logger
  config,        // 插件自己的配置读取器
}
```

### 读配置

`ctx.config` 的键**不含插件名前缀**，内部自动拼成 `{插件名}.{key}`。

```ts
const words = await ctx.config.stringList('blockedWords', []);  // comment-guard.blockedWords
const enabled = await ctx.config.boolean('enabled', true);     // comment-guard.enabled
const timeout = await ctx.config.number('timeout', 30);        // comment-guard.timeout
```

空字符串一律视为「未设置」而回落到默认值 —— 后台把输入框清空时存的就是空串，
那表示用默认值，而不是「配置就是一个空字符串」。

非数字的 number、无法识别的 boolean 都会回落到默认值，
**不会返回 NaN 或意外的真值**。

## 错误处理语义

这是插件系统最重要的性质，请务必理解：

### 插件崩溃 ≠ 拦截

```ts
beforeCreate(input, ctx) {
  throw new Error('内部错误');   // ← 不会拦截！评论正常发布，只记日志
}
```

**扩展代码的错误不能影响主流程。** 插件崩溃时：
- 记录日志：`[plugins] <name> beforeCreate failed: <message>`
- 主流程照常进行，用户无感知

### 想拦截，返回字符串

```ts
beforeCreate(input, ctx) {
  return '这里不让发';   // ← 拦截，用户看到这段文案
}
```

或者抛专用错误（适合在插件内部深层调用时中断）：

```ts
import { PluginRejectionError } from '../../src/plugins/registry';

throw new PluginRejectionError('my-plugin', '请先登录再评论');
```

### 短路规则

`beforeCreate` / `beforeSave` 按注册顺序执行，**任一插件返回拒绝就短路**，
后续插件不再执行。

`afterCreate` / `afterSave` 则**全部都会执行完**，
某个失败不影响其他（评论已落库，不能因为插件失败而回滚）。

## 写插件时的注意事项

**插件名必须是唯一的小写 kebab-case。** 它会进 URL 路径与配置键名，
含大写或空格会导致路由和配置都失效。

**不要在 `beforeCreate` 里做耗时操作。** 它挡在用户请求的主路径上。
需要异步处理请放 `afterCreate`。

**`request` 在 `setup` 阶段是 undefined。** 需要请求上下文请用其他钩子。

**日志统一走 `ctx.log`。** 输出自动带 `[plugin:<name>]` 前缀，便于过滤。

## 测试

```ts
import { makePluginContext } from '../plugins/__tests__/test-helpers';

// 测钩子逻辑，不需要真实数据库
const ctx = makePluginContext({
  pluginName: 'my-plugin',
  values: { 'my-plugin.blockedWords': '广告' },
});

const result = await pluginRegistry.beforeCommentCreate(
  { feedId: 1, content: '含广告的评论', userId: null, isLoggedIn: false, isAdmin: false },
  ctx,
);
```

测「是否真的接进了业务流程」要起完整 app：

```ts
const { app, sqlite, env } = await setupTestApp(CommentService);
pluginRegistry.reset();   // 每个测试前重置，避免相互污染
```

## 内置插件

| 插件 | 作用 | 配置 |
|---|---|---|
| `comment-guard` | 拦截含敏感词的评论 | `comment-guard.enabled`、`comment-guard.blockedWords` |

完整示例见 `server/plugins/comment-guard/index.ts`。

---

## 启停与状态

后台 `/admin/plugins` 提供：

- **状态查看**：每个插件的 `enabled` / `disabled` / `error`，以及它声明了哪些扩展点
- **一键启停**：立刻生效，不需要重新部署

### 状态存在哪

存 `serverConfig` 的 `plugins.enabled`，值是**逗号分隔的插件名列表**：

```
plugins.enabled = comment-guard,my-plugin
```

存列表而非逐个 boolean 键，是因为插件增删时不用清理孤儿键。

### 为什么每个请求都要读一次

Worker 是**常驻 isolate**。如果只在启动时读一次配置，管理员在后台关掉插件后，
要等 isolate 被回收才生效 —— 表现为「点了没反应，重启才好」。

所以 `register-middlewares.ts` 里挂了一个中间件，每个请求开始时调
`syncEnabledFromConfig`。这是后台开关能立即生效的关键。

### 停用 = 从列表移除

停用是把插件名从 `plugins.enabled` 里**删掉**，不是往「停用列表」里加。
后者会让列表无限增长，而且新插件会默认处于停用状态。

**空列表意味着全部停用。** 管理员还没配置过时插件不会自动跑起来 ——
新装一个插件就开始拦评论，不是预期行为。

### 出错的插件不能切换

`setup` 失败的插件状态是 `error`，后台的启停按钮会被禁用。
理由：启用一个没跑起来的插件会让管理员误以为已经生效。
真要修，得先改代码重新部署。

## 前端页面扩展

服务端钩子管行为，前端注册表管页面。两边 `manifest.name` 相同即为同一个插件。

### 接入三步

**1. 写页面** — `client/plugins/<name>/index.tsx`

```tsx
import type { FrontendPlugin } from '../../src/plugins/registry';

function MyPage() {
  return <div>我的插件页面</div>;
}

const plugin: FrontendPlugin = {
  manifest: { name: 'my-plugin', displayName: '我的插件', version: '1.0.0' },
  pages: [
    { path: '/plugin/my-page', title: '我的页面', Component: MyPage },
  ],
};

export default plugin;
```

**2. 注册** — `client/src/plugins/index.ts`

```ts
import myPlugin from '../../plugins/my-plugin';
registerFrontendPlugin(myPlugin);
```

**3. 访问** — `/plugin/my-page`

### 路径必须以 `/plugin/` 开头

`/plugin/` 是保留前缀。这样插件**不能覆盖** `/admin/users` 这类内置页面 ——
否则一个写错的插件能把管理后台整个顶掉。

注册时就会校验前缀和路径冲突，冲突直接抛错，不等到用户点开才发现。

### requireAdmin 只是 UI 隐藏

```ts
{ path: '/plugin/admin-only', title: '受限', Component: Page, requireAdmin: true }
```

`requireAdmin: true` 只是让无权限用户看到「无权限」而不是页面内容。

**它不是安全边界。** 前端能显示组件不代表用户有权访问它背后的数据 ——
服务端接口必须各自鉴权。

### 路由顺序

插件页面注册在 `/:alias`（文章别名通配路由）**之前**。
wouter 按注册顺序匹配，顺序反了插件路径会被当成文章别名去解析。
`routes.tsx` 里已经处理好，不用插件作者操心。

## 内置插件

| 名称 | 前端页面 | 服务端钩子 |
|---|---|---|
| `hello` | `/plugin/hello` | — |
| `comment-guard` | — | `comment.beforeCreate` |

完整示例见 `client/plugins/hello/index.tsx`
与 `server/plugins/comment-guard/index.ts`。
