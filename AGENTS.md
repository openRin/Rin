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

# Testing
bun run test              # Run all tests (client + server)
bun run test:server       # Run server tests only
 bun run test:coverage     # Run tests with coverage report
```

## Rin CLI

The project uses a unified CLI tool located at `cli/bin/rin.ts`. Command implementations live under `cli/src/{commands,tasks,lib}`.

### CLI Commands
- `bun cli/bin/rin.ts dev [options]` - Start development server
- `bun cli/bin/rin.ts deploy [options]` - Deploy to Cloudflare
- `bun cli/bin/rin.ts db migrate` - Run database migrations
- `bun cli/bin/rin.ts release <version>` - Create a new release

## Architecture Status

This repository is a product monorepo, not a framework monorepo.

- `rin` should learn from `~/projects/rine` on module boundaries and type discipline.
- `rin` should NOT blindly copy `rine`'s `contracts/core/renderer/adapters/apps` layout.
- The current repository still centers around a concrete app: React frontend, Cloudflare Worker backend, shared API package, and local CLI tooling.
- If a change improves directory symmetry but does not improve dependency boundaries, it is usually the wrong refactor.

### Current Reality

- `client/` is the web application, not a reusable package.
- `server/` is the Worker application, not a generic framework core.
- `packages/api/` is the only stable shared package today.
- `packages/ui/` exists in the tree but is not yet a real workspace package; treat it as incomplete work until it has its own `package.json`, tsconfig, exports, and consumers.
- `cli/` is an engineering tool for this repo, not a runtime dependency of the product.

### Refactor Direction

When restructuring, prefer this target shape over a direct clone of `rine`:

```text
rin/
├── apps/
│   ├── web/            # current client app
│   └── worker/         # current server app
├── packages/
│   ├── api/            # shared request/response types and schemas
│   ├── ui/             # real reusable UI primitives and markdown-related UI
│   ├── web-core/       # app shell, providers, routing, layout composition
│   ├── server-core/    # app assembly, middleware, route registration, env typing
│   └── config/         # shared config keys, defaults, parsing, client-safe views
├── tools/
│   └── cli/            # current CLI moved only when boundaries are stable
```

This is a direction, not a mandate to rename everything immediately.

## Refactor Guardrails

All agents must follow these rules for architecture work:

1. Do not start by renaming `client/` to `apps/web` or `server/` to `apps/worker`.
2. Do not create empty framework-style packages just to mirror `rine`.
3. Do not introduce a `renderer` package unless the app actually gains SSR or shared rendering orchestration.
4. Do not split every server utility into `adapters/*` packages unless there are at least two credible implementations or an immediate runtime boundary that justifies it.
5. Do not move code across the repo solely for aesthetics if imports, tests, and ownership get worse.

### Required Refactor Order

For any substantial restructure, agents should work in this order:

1. Stabilize boundaries.
   - Create real workspace packages before migrating code into them.
   - Add missing package manifests, tsconfig files, and explicit exports.
   - Introduce a root TypeScript base config before broad moves.
2. Extract shared logic.
   - Move truly shared UI into `packages/ui`.
   - Move shared config models and parsing into a dedicated shared package.
   - Keep app-specific composition in the app layer.
3. Simplify application entrypoints.
   - Split frontend bootstrap, providers, routes, and layout composition.
   - Split backend app assembly, middleware registration, and runtime entry handling.
4. Rename directories only after the dependency graph is cleaner.

If a proposed refactor skips step 1 and jumps to step 4, it should be treated as suspect.

## Layering Rules

### Frontend

- `client/src/App.tsx` should trend toward composition only: providers, routes, and top-level layout wiring.
- Page initialization, session loading, config hydration, and permission gating should move into dedicated modules when touched.
- Reusable presentational components belong in `packages/ui` only when they are app-agnostic.
- Components that depend on `client` state containers, Wouter routing, or app-specific permissions should remain in the app layer.

### Backend

- `server/src/core` currently acts as app assembly, not framework core. Keep that distinction explicit.
- Route registration, middleware wiring, error mapping, and runtime entrypoints should be separated when refactoring.
- Business services stay close to the app until a stable abstraction clearly exists.
- Shared contracts and config types should move out before shared behavior moves out.

### Shared Packages

- `packages/api` is for shared API contracts, schemas, validators, and transport-facing types.
- Shared packages must not depend on `client/` or `server/` application modules.
- Shared packages should expose explicit entrypoints and avoid deep relative imports from consumers.

## Required Checks Before Structural Changes

Before any non-trivial reorganization, agents must do all of the following:

1. Read this `AGENTS.md`.
2. Inspect the current package/workspace manifests.
3. Search for all imports of the modules being moved.
4. Verify whether the target package already has a real manifest and public entrypoint.
5. Explain why the destination layer is better than the current one.

If those checks are not done, the refactor is not ready.

## Anti-Patterns

Avoid these common mistakes:

- Copying `rine` abstractions into `rin` without a product need.
- Moving files into `packages/` while still importing app internals from them.
- Creating `core` modules that actually contain product-specific assembly.
- Mixing sensitive server-only configuration logic with client-safe config views.
- Leaving half-migrated directories that look shared but are not buildable or imported anywhere.

## Testing

The project has comprehensive test coverage for both client and server:

### Client Tests (Vitest)
- **Location**: `client/src/**/__tests__/*.test.ts`
- **Runner**: Vitest with jsdom environment
- **Commands**:
  ```bash
  cd client && bun run test          # Run tests once
  cd client && bun run test:watch    # Watch mode
  cd client && bun run test:coverage # With coverage report
  ```

### Server Tests (Bun)
- **Location**: `server/src/**/__tests__/*.test.ts`, `server/tests/`
- **Runner**: Bun's native test runner (`bun:test`)
- **Commands**:
  ```bash
  cd server && bun run test          # Run tests once
  cd server && bun run test:coverage # With coverage report
  ```

### Test Structure
- Unit tests for services, utilities, and core functionality
- Integration tests for API endpoints
- Security tests for mock isolation
- Fixtures and mocks in `server/tests/fixtures/`

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
ln -s ../../cli/templates/git-commit-msg.sh .git/hooks/commit-msg
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
├── packages/        # Shared packages
│   └── api/         # @rin/api - Shared API types
├── cli/             # Rin CLI tool
│   └── bin/
│       └── rin.ts   # CLI entry point
├── docs/            # Rspress documentation
├── cli/             # Rin CLI entrypoints, commands, tasks, templates
└── scripts/         # Compatibility wrappers around CLI tasks
```

### Key Technologies

- **Client**: React 18, Vite, TailwindCSS, Wouter (routing), i18next, Vitest
- **Server**: Hono-like router, Drizzle ORM, Cloudflare Workers/D1, bun:test
- **Shared Types**: @rin/api package for type-safe API communication
- **Package Manager**: Bun
- **Build**: Turbo for monorepo orchestration
- **Testing**: Vitest (client), Bun native test runner (server)
