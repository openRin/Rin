# 轻量级框架重构完成

## 重构概述

已将 ElysiaJS 后端框架重构为轻量级自定义框架，专门针对 Cloudflare Workers 的"用过即走"特性优化。

## 主要变化

### 1. 移除的依赖
- **Elysia** - 重量级 Web 框架
- **@elysiajs/cors** - CORS 中间件
- **@elysiajs/server-timing** - 服务器计时
- **@elysiajs/cron** - 定时任务
- **@elysiajs/eden** - 类型安全客户端
- **@sinclair/typebox** - 类型验证
- **typedi** - 依赖注入
- **reflect-metadata** - 元数据反射
- **openapi-types** - OpenAPI 类型

### 2. 新增的核心模块 (`src/core/`)
- **router.ts** - 轻量级路由系统
- **types.ts** - TypeScript 类型定义
- **middleware.ts** - 中间件系统 (CORS, Timing)
- **setup.ts** - 应用配置和依赖注入
- **base.ts** - 基础应用构建器
- **index.ts** - 工具函数和类型导出

### 3. 架构特点

#### 按需加载
```typescript
// 根据请求路径动态加载对应的服务
export function createApp(env: Env, path: string) {
    const group = getFirstPathSegment(path);
    switch (group) {
        case 'feed':
            FeedService(app);
            CommentService(app);
            break;
        // ... 其他服务
    }
}
```

#### 轻量级路由
- 简单的路径匹配算法
- 支持参数提取 (`:id`)
- 支持路由分组
- 无需预编译或 AOT

#### 精简的上下文
```typescript
interface Context {
    request: Request;
    url: URL;
    params: Record<string, string>;
    query: Record<string, any>;
    headers: Record<string, string>;
    body: any;
    store: Record<string, any>;  // 依赖注入
    set: { status: number; headers: Headers };
    cookie: Record<string, CookieValue>;
    jwt?: JWTUtils;
    oauth2?: OAuth2Utils;
    uid?: number;
    admin: boolean;
}
```

### 4. 服务迁移

所有服务已迁移至新框架：
- ✅ user.ts - 用户认证
- ✅ feed.ts - 文章管理
- ✅ comments.ts - 评论系统
- ✅ tag.ts - 标签管理
- ✅ config.ts - 配置管理
- ✅ storage.ts - 文件存储
- ✅ friends.ts - 友链管理
- ✅ moments.ts - 动态管理
- ✅ rss.ts - RSS 订阅
- ✅ seo.ts - SEO 页面
- ✅ favicon.ts - 图标管理
- ✅ ai-config.ts - AI 配置

### 5. 性能优化

#### 启动时间
- 移除了 Elysia 的 AOT 编译
- 无需预注册所有路由
- 每个请求只初始化必要的服务

#### 内存占用
- 移除了大型框架的内存开销
- 按需创建依赖实例
- 无全局状态管理

#### 包体积
- 移除了约 15 个重量级依赖
- 核心框架代码 < 10KB

## 使用方法

### 开发
```bash
cd server
bun install
bun run dev
```

### 部署
```bash
bun run cf:deploy
```

## 兼容性

- 保持原有的 API 接口不变
- 保持原有的数据库 Schema
- 保持原有的环境变量配置
- 保持原有的前端调用方式

## 技术细节

### 路由匹配算法
```typescript
private extractParams(routePath: string, pathname: string): Record<string, string> | null {
    const routeParts = routePath.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
            params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
            return null;
        }
    }
    return params;
}
```

### 中间件执行流程
1. 解析请求路径和参数
2. 解析请求体 (JSON/FormData)
3. 验证请求 Schema
4. 执行全局中间件 (CORS, Timing)
5. 执行认证中间件 (JWT 解析)
6. 执行路由处理器
7. 序列化响应

## 后续优化建议

1. **缓存优化**: 考虑使用 Cloudflare Cache API
2. **边缘渲染**: 利用 Workers 的地理分布特性
3. **Durable Objects**: 对于需要状态保持的功能
4. **Analytics**: 集成 Cloudflare Analytics

## 文件结构

```
server/src/
├── _worker.ts          # Worker 入口
├── server.ts           # 服务路由分发
├── core/               # 轻量级框架核心
│   ├── router.ts       # 路由系统
│   ├── types.ts        # 类型定义
│   ├── middleware.ts   # 中间件
│   ├── setup.ts        # 配置初始化
│   ├── base.ts         # 应用构建器
│   └── index.ts        # 工具导出
├── services/           # API 服务
├── utils/              # 工具函数
└── db/                 # 数据库 Schema
```
