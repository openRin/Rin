# Testing Guide

This document provides a comprehensive guide to testing in the Rin project.

## Overview

Rin uses one test runner across the repository:

- **Runner**: [Bun's native test runner](https://bun.sh/docs/cli/test) and the `bun:test` API
- **Client environment**: React component tests import the shared jsdom setup
- **Server environment**: Worker-compatible globals and an in-memory SQLite database

## Running Tests

### All Tests

```bash
# Run every test with the canonical root command
bun run test
```

### Client Tests

```bash
# Run tests once
bun run test:client

# Run tests in watch mode
bun run test:client:watch

# Run tests with coverage
bun run test:client:coverage
```

### Server Tests

```bash
# Run tests once
bun run test:server

# Run tests with coverage
bun run test:server:coverage
```

## Test Structure

### Client Tests

Location: `client/src/**/__tests__/*.test.ts`

```typescript
// Example client test
import '../../test/setup';
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Server Tests

Locations:
- Unit tests: `server/src/**/__tests__/*.test.ts`
- Integration tests: `server/tests/integration/*.test.ts`
- Security tests: `server/tests/security/*.test.ts`

```typescript
// Example server test
import { describe, it, expect } from 'bun:test';
import { myFunction } from '../utils/myFunction';

describe('myFunction', () => {
  it('should return correct result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## Writing Tests

### Client Testing

1. **Component Tests**: Test React components in isolation
2. **API Client Tests**: Test the HTTP client and API calls
3. **Utility Tests**: Test helper functions

Example:
```typescript
import { describe, expect, it } from 'bun:test';
import { apiClient } from '../api/client';

describe('API Client', () => {
  it('should handle API errors', async () => {
    const result = await apiClient.get('/nonexistent');
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(404);
  });
});
```

### Server Testing

1. **Service Tests**: Test business logic in services
2. **Router Tests**: Test API endpoints
3. **Utility Tests**: Test helper functions

Example with database:
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockDB } from '../../tests/fixtures';

describe('FeedService', () => {
  let db: any;

  beforeEach(() => {
    const mockDB = createMockDB();
    db = mockDB.db;
  });

  it('should create a feed', async () => {
    // Test with mock database
  });
});
```

## Test Fixtures

Server tests use fixtures for mock data:

- `server/tests/fixtures/index.ts` - Mock database and environment setup
- `server/tests/test-api-client.ts` - Type-safe API client for tests

## Coverage

The root command generates one combined coverage report:

```bash
# All repository tests
bun run test:coverage
```

The combined report is generated in `coverage/`. Package-level coverage commands still write to `client/coverage/` or `server/coverage/` when run from those directories.

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `trunk` branches
- Every Pull Request
- Before deployment (blocking)

See [GitHub Actions Workflows](./deploy.mdx#github-actions-workflows) for details.

## Best Practices

1. **Write tests for new features**: Every new feature should include tests
2. **Test edge cases**: Include tests for error conditions and boundary cases
3. **Use descriptive names**: Test descriptions should clearly state what is being tested
4. **Keep tests independent**: Each test should be able to run independently
5. **Mock external dependencies**: Use mocks for external APIs and services
6. **Use one runner**: Import test APIs only from `bun:test`; do not add Vitest or another runner

## Troubleshooting

### Client Tests Failing

```bash
# Run through the canonical client entrypoint
bun run test:client
```

### Server Tests Failing

```bash
# Ensure you're in the server directory
cd server
bun test
```

### Coverage Not Generated

Make sure you have the coverage reporter configured in your test config.

## Additional Resources

- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/docs/)
