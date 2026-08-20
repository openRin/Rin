# 测试指南

本文档提供 Rin 项目中测试的全面指南。

## 概述

Rin 在整个仓库统一使用一套测试运行器：

- **运行器**：[Bun 原生测试运行器](https://bun.sh/docs/cli/test) 与 `bun:test` API
- **客户端环境**：React 组件测试导入统一的 jsdom 初始化文件
- **服务端环境**：Worker 兼容全局对象与内存 SQLite 数据库

## 运行测试

### 所有测试

```bash
# 使用根目录标准命令运行全部测试
bun run test
```

### 客户端测试

```bash
# 运行一次测试
bun run test:client

# 监视模式运行测试
bun run test:client:watch

# 运行测试并生成覆盖率报告
bun run test:client:coverage
```

### 服务端测试

```bash
# 运行一次测试
bun run test:server

# 运行测试并生成覆盖率报告
bun run test:server:coverage
```

## 测试结构

### 客户端测试

位置：`client/src/**/__tests__/*.test.ts`

```typescript
// 客户端测试示例
import '../../test/setup';
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('应该正确渲染', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 服务端测试

位置：
- 单元测试：`server/src/**/__tests__/*.test.ts`
- 集成测试：`server/tests/integration/*.test.ts`
- 安全测试：`server/tests/security/*.test.ts`

```typescript
// 服务端测试示例
import { describe, it, expect } from 'bun:test';
import { myFunction } from '../utils/myFunction';

describe('myFunction', () => {
  it('应该返回正确结果', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## 编写测试

### 客户端测试

1. **组件测试**：单独测试 React 组件
2. **API 客户端测试**：测试 HTTP 客户端和 API 调用
3. **工具函数测试**：测试辅助函数

示例：
```typescript
import { describe, expect, it } from 'bun:test';
import { apiClient } from '../api/client';

describe('API Client', () => {
  it('应该处理 API 错误', async () => {
    const result = await apiClient.get('/nonexistent');
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(404);
  });
});
```

### 服务端测试

1. **服务测试**：测试服务中的业务逻辑
2. **路由测试**：测试 API 端点
3. **工具函数测试**：测试辅助函数

使用数据库的示例：
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockDB } from '../../tests/fixtures';

describe('FeedService', () => {
  let db: any;

  beforeEach(() => {
    const mockDB = createMockDB();
    db = mockDB.db;
  });

  it('应该创建 feed', async () => {
    // 使用模拟数据库进行测试
  });
});
```

## 测试夹具

服务端测试使用夹具来设置模拟数据：

- `server/tests/fixtures/index.ts` - 模拟数据库和环境设置
- `server/tests/test-api-client.ts` - 用于测试的类型安全 API 客户端

## 覆盖率

根目录命令会生成一份合并覆盖率报告：

```bash
# 全仓测试覆盖率
bun run test:coverage
```

合并报告生成在 `coverage/`。若从客户端或服务端目录单独运行覆盖率命令，报告仍分别写入 `client/coverage/` 或 `server/coverage/`。

## CI/CD 集成

测试在以下情况自动运行：
- 每次推送到 `main` 或 `trunk` 分支
- 每个 Pull Request
- 部署前（阻塞性）

详细信息请参阅 [GitHub Actions 工作流](./deploy.mdx#github-actions-工作流)。

## 最佳实践

1. **为新功能编写测试**：每个新功能都应该包含测试
2. **测试边界情况**：包括错误条件和边界情况的测试
3. **使用描述性名称**：测试描述应该清楚说明正在测试什么
4. **保持测试独立**：每个测试都应该能够独立运行
5. **模拟外部依赖**：为外部 API 和服务使用模拟
6. **统一运行器**：测试 API 只从 `bun:test` 导入，不要再添加 Vitest 或其他运行器

## 故障排除

### 客户端测试失败

```bash
# 通过标准客户端入口运行
bun run test:client
```

### 服务端测试失败

```bash
# 确保你在 server 目录中
cd server
bun test
```

### 覆盖率未生成

确保你在测试配置中配置了覆盖率报告器。

## 其他资源

- [Bun 测试运行器](https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/docs/)
