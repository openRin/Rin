# AGENTS.md - Rin Project Guidelines

## Build Commands

```bash
# Development (using Rin CLI)
bun dev                    # Start both client and server
bun dev:client            # Client only (Vite + React)
bun dev:server            # Server only (Wrangler dev server on port 11498)
bun dev:cron              # Server with cron triggers enabled

# Building
bun run build             # Build all workspaces (turbo)
bun run check             # TypeScript type check (turbo)

# Database (using Rin CLI)
bun run db:generate       # Generate Drizzle migrations
bun run db:migrate        # Run local database migrations

# Formatting
bun run format:check      # Check formatting
bun run format:write      # Fix formatting

# Deployment (using Rin CLI)
bun run deploy            # Deploy both frontend (Pages) and backend (Workers)
bun run deploy:server     # Deploy backend only
bun run deploy:client     # Deploy frontend only

# Release (using Rin CLI)
bun run release <version> # Create a new release (patch/minor/major/x.y.z)
```

## Rin CLI

The project uses a unified CLI tool located at `cli/bin/rin.ts`. All development, deployment, and database commands are available through this CLI.

### CLI Commands
- `bun cli/bin/rin.ts dev [options]` - Start development server
- `bun cli/bin/rin.ts deploy [options]` - Deploy to Cloudflare
- `bun cli/bin/rin.ts db migrate` - Run database migrations
- `bun cli/bin/rin.ts release <version>` - Create a new release

## Testing

**No test runner configured.** The project uses `@cloudflare/vitest-pool-workers` in devDependencies but no test scripts are defined. To add tests, create a `test` script in the appropriate package.json.

## Code Style Guidelines

### TypeScript

- **Target**: ESNext with ESNext modules
- **Strict mode**: Enabled
- **Module resolution**: `bundler` mode
- **JSX**: `react-jsx` transform
- Allow importing `.ts` extensions directly
- Skip lib check for faster builds
- Unused locals/parameters: NOT enforced (set to false in server, true in client)

### Imports

```typescript
// External imports first (alphabetical)
import { eq, and } from "drizzle-orm";
import React from 'react';

// Internal imports (alphabetical)
import { Router } from "../core/router";
import { feeds } from "../db/schema";
```

### Naming Conventions

- **Files**: kebab-case (e.g., `feed_card.tsx`, `ai-config.ts`)
- **Components**: PascalCase (e.g., `FeedCard`, `ErrorBoundary`)
- **Functions**: camelCase (e.g., `FeedService`, `createClient`)
- **Types/Interfaces**: PascalCase (e.g., `ServiceLoader`, `Context`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Database tables**: snake_case in schema

### React Components

- Use functional components with hooks
- Props interface defined inline or as separate type
- Use `useMemo` for expensive computations
- Use `useTranslation()` hook for i18n
- Error boundaries wrap the app

### Server (Cloudflare Workers)

- Service pattern: Each feature is a service function that takes a `Router`
- Lazy loading for heavy dependencies (WordPress import modules)
- Database via Drizzle ORM with D1
- Caching via custom CacheImpl utility

### Commit Messages

Must follow conventional commits format:
```
feat: add new feature
chore: update dependencies
fix: resolve bug
docs: update documentation
ci: update CI configuration
style: formatting changes
test: add tests
pref: performance improvements
```

Setup the commit hook:
```bash
ln -s ../../scripts/git-commit-msg.sh .git/hooks/commit-msg
```

### Error Handling

- Server: Return appropriate HTTP status codes via `set.status`
- Client: Use error boundaries (`GlobalErrorBoundary`)
- TypeScript strict null checks enabled

### Project Structure

```
/home/xeu/projects/rin/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── page/        # Page components
│   │   ├── api/         # API client
│   │   └── utils/       # Utilities
├── server/          # Cloudflare Workers backend
│   ├── src/
│   │   ├── services/    # API route handlers
│   │   ├── db/         # Database schema
│   │   ├── core/       # Router and types
│   │   └── utils/      # Utilities
├── docs/           # Rspress documentation
└── scripts/        # Build and dev scripts
```

### Key Technologies

- **Client**: React 18, Vite, TailwindCSS, Wouter (routing), i18next
- **Server**: Hono-like router, Drizzle ORM, Cloudflare Workers/D1
- **Package Manager**: Bun
- **Build**: Turbo for monorepo orchestration
