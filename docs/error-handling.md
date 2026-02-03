# 错误处理系统使用指南

## 服务端错误处理

### 1. 错误类

新的错误处理系统提供了一系列结构化的错误类：

```typescript
import {
  ValidationError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
  DatabaseError,
  ExternalServiceError,
} from '../errors';
```

### 2. 在路由处理器中使用

**旧的方式（不推荐）：**
```typescript
group.get('/feed/:id', async (ctx: Context) => {
    const { id } = ctx.params;
    const feed = await db.query.feeds.findFirst({
        where: eq(feeds.id, parseInt(id))
    });
    
    if (!feed) {
        ctx.set.status = 404;
        return 'Feed not found';  // 不一致的错误格式
    }
    
    return feed;
});
```

**新的方式（推荐）：**
```typescript
import { NotFoundError, ForbiddenError } from '../errors';

group.get('/feed/:id', async (ctx: Context) => {
    const { id } = ctx.params;
    const feed = await db.query.feeds.findFirst({
        where: eq(feeds.id, parseInt(id))
    });
    
    if (!feed) {
        throw new NotFoundError('Feed');  // 自动返回结构化错误
    }
    
    if (feed.draft && !ctx.admin) {
        throw new ForbiddenError('You do not have permission to view this draft');
    }
    
    return feed;
});
```

### 3. 错误响应格式

所有错误都会返回统一的 JSON 格式：

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Feed not found",
    "details": null,
    "requestId": "abc123-def456"
  }
}
```

### 4. 验证错误

```typescript
import { ValidationError } from '../errors';

if (!title || title.length < 3) {
    throw new ValidationError('Title must be at least 3 characters', [
        { field: 'title', message: 'Title is too short' }
    ]);
}
```

### 5. 外部服务错误

```typescript
import { ExternalServiceError } from '../errors';

try {
    const response = await fetch('https://api.external.com/data');
    if (!response.ok) {
        throw new ExternalServiceError('External API', 'Failed to fetch data');
    }
} catch (error) {
    if (error instanceof ExternalServiceError) {
        throw error;
    }
    throw new ExternalServiceError('External API', error.message);
}
```

## 客户端错误处理

### 1. 错误边界

全局错误边界已经在 `main.tsx` 中设置，会自动捕获渲染错误。

**在特定路由中使用错误边界：**
```tsx
import { RouteErrorBoundary } from './components/error-boundary';

<RouteErrorBoundary>
  <FeedPage />
</RouteErrorBoundary>
```

**在特定组件中使用错误边界：**
```tsx
import { ComponentErrorBoundary } from './components/error-boundary';

<ComponentErrorBoundary placeholder={<div>Failed to load comments</div>}>
  <CommentList />
</ComponentErrorBoundary>
```

### 2. useAsync Hook

用于处理异步操作和错误：

```tsx
import { useAsync } from './hooks/useError';

function FeedList() {
  const { data: feeds, loading, error, execute } = useAsync(
    () => client.feed.list(),
    {
      immediate: true,
      onError: (err) => {
        console.error('Failed to load feeds:', err);
      }
    }
  );

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error.message} />;
  
  return <FeedList data={feeds} />;
}
```

### 3. useApi Hook

专门用于 API 调用：

```tsx
import { useApi } from './hooks/useError';

function CreateFeed() {
  const { execute: createFeed, loading, error } = useApi(
    (data) => client.feed.create(data),
    {
      onSuccess: () => {
        // 显示成功消息
      },
      onError: (err) => {
        // 处理错误
      }
    }
  );

  const handleSubmit = async (data) => {
    await createFeed(data);
  };
}
```

### 4. 错误处理工具函数

```tsx
import { 
  parseApiError, 
  isNetworkError, 
  isAuthError, 
  isNotFoundError,
  getUserFriendlyMessage 
} from './components/error-boundary';

// 解析错误
const error = parseApiError(apiError);

// 检查错误类型
if (isNetworkError(error)) {
  showToast('Network connection failed');
}

if (isAuthError(error)) {
  redirectToLogin();
}

// 获取用户友好的错误消息
const message = getUserFriendlyMessage(error);
```

### 5. useErrorHandler Hook

集中式错误处理：

```tsx
import { useErrorHandler } from './hooks/useError';

function MyComponent() {
  const { handleError } = useErrorHandler({
    onNetworkError: () => {
      showOfflineModal();
    },
    onAuthError: () => {
      logout();
    },
    showToast: (msg) => toast.error(msg)
  });

  const fetchData = async () => {
    try {
      const data = await api.getData();
    } catch (error) {
      handleError(error);
    }
  };
}
```

## 迁移指南

### 服务端迁移

1. **替换旧的状态码设置：**
   ```typescript
   // 旧
   ctx.set.status = 403;
   return 'Permission denied';
   
   // 新
   throw new ForbiddenError();
   ```

2. **替换手动错误构造：**
   ```typescript
   // 旧
   return new Response(JSON.stringify({ error: 'Not found' }), { 
     status: 404,
     headers: { 'Content-Type': 'application/json' }
   });
   
   // 新
   throw new NotFoundError('Resource');
   ```

### 客户端迁移

1. **替换 Promise.catch：**
   ```tsx
   // 旧
   client.feed.list()
     .then(({ data }) => setFeeds(data))
     .catch(err => console.error(err));
   
   // 新
   const { data, error } = useApi(() => client.feed.list(), { immediate: true });
   ```

2. **添加错误边界：**
   ```tsx
   // 在路由级别
   <RouteErrorBoundary>
     <Route component={FeedPage} />
   </RouteErrorBoundary>
   ```

## 最佳实践

1. **始终使用结构化的错误类**，不要手动构造错误响应
2. **在客户端使用 Error Boundaries** 防止应用崩溃
3. **使用 useAsync 或 useApi** 处理异步操作
4. **提供用户友好的错误消息**，不要直接显示技术错误
5. **记录错误** 用于调试，但不要暴露敏感信息给用户
6. **区分操作错误和编程错误**：
   - 操作错误（如验证失败）使用特定的错误类
   - 编程错误（如空指针）应该被记录并返回通用错误消息

## 错误代码对照表

| HTTP 状态 | 错误代码 | 使用场景 |
|-----------|----------|----------|
| 400 | VALIDATION_ERROR | 输入验证失败 |
| 400 | BAD_REQUEST | 请求格式错误 |
| 401 | UNAUTHORIZED | 未登录 |
| 401 | TOKEN_EXPIRED | Token 过期 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突 |
| 422 | UNPROCESSABLE_ENTITY | 无法处理的实体 |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 内部服务器错误 |
| 500 | DATABASE_ERROR | 数据库错误 |
| 500 | EXTERNAL_SERVICE_ERROR | 外部服务错误 |
| 503 | SERVICE_UNAVAILABLE | 服务不可用 |
