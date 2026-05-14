# Testing Guide

This document provides a comprehensive guide to testing in the Rin project.

## Overview

Rin uses different testing frameworks for the client and server:

- **Client**: [Vitest](https://vitest.dev/) with jsdom environment for React component testing
- **Server**: [Bun's native test runner](https://bun.sh/docs/cli/test) with in-memory SQLite database

## Running Tests

### All Tests

```bash
# Run both client and server tests
bun run test
```

### Client Tests

```bash
cd client

# Run tests once
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Server Tests

```bash
cd server

# Run tests once
bun run test

# Run tests with coverage
bun run test:coverage
```

## Test Structure

### Client Tests

Location: `client/src/**/__tests__/*.test.ts`

```typescript
// Example client test
import { describe, it, expect } from 'vitest';
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
import { describe, it, expect } from 'vitest';
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

Both client and server support code coverage reporting:

```bash
# Client coverage
bun run test:coverage

# Server coverage  
bun run test:coverage
```

Coverage reports are generated in:
- Client: `client/coverage/`
- Server: `server/coverage/`

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop` branches
- Every Pull Request
- Before deployment (blocking)

See [GitHub Actions Workflows](./deploy.mdx#github-actions-workflows) for details.

## Best Practices

1. **Write tests for new features**: Every new feature should include tests
2. **Test edge cases**: Include tests for error conditions and boundary cases
3. **Use descriptive names**: Test descriptions should clearly state what is being tested
4. **Keep tests independent**: Each test should be able to run independently
5. **Mock external dependencies**: Use mocks for external APIs and services

## Troubleshooting

### Client Tests Failing

```bash
# Clear cache and reinstall dependencies
rm -rf client/node_modules
bun install
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

- [Vitest Documentation](https://vitest.dev/guide/)
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/docs/)
