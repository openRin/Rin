# Local Development Guide

This document explains how to develop and debug the Rin project locally.

## Quick Start

### 1. Clone the Project

```bash
git clone https://github.com/openRin/Rin.git
cd Rin
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment Variables

```bash
# Copy the example configuration file
cp .env.example .env.local

# Edit the configuration file with your actual settings
vim .env.local  # or use your preferred editor
```

### 4. Start the Development Server

```bash
bun run dev
```

This will automatically:
- ✅ Generate `wrangler.toml` configuration file
- ✅ Generate `.dev.vars` sensitive information file
- ✅ Run database migrations
- ✅ Start development server (port 11498 - unified frontend and backend)

Visit http://localhost:11498 to start developing!

## Environment Variable Configuration

All configurations are centralized in the `.env.local` file:

### Frontend Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NAME` | Yes | Website name | `My Blog` |
| `AVATAR` | Yes | Avatar URL | `https://...` |
| `DESCRIPTION` | No | Website description | `A blog` |
| `PAGE_SIZE` | No | Pagination size | `5` |
| `RSS_ENABLE` | No | Enable RSS | `false` |

### Backend Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `S3_ENDPOINT` | Yes | S3/R2 endpoint | `https://...r2.cloudflarestorage.com` |
| `S3_BUCKET` | Yes | Bucket name | `images` |
| `S3_REGION` | No | Region | `auto` |
| `S3_FOLDER` | No | Image storage path | `images/` |
| `WEBHOOK_URL` | No | Notification Webhook | `https://...` |

### Sensitive Configuration (Required)

| Variable | Description |
|----------|-------------|
| `RIN_GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `RIN_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `JWT_SECRET` | JWT signing key |
| `S3_ACCESS_KEY_ID` | S3 Access Key |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Key |

## Common Commands

```bash
# Start full development environment (recommended)
bun run dev

# Start frontend only
bun run dev:client

# Start backend only
bun run dev:server

# Run database migrations
bun run db:migrate

# Generate database migration files
bun run db:generate

# Regenerate configuration files
bun run dev:setup

# Build the project
bun run build

# Clean generated files
bun run clean

# Run type checking
bun run check

# Format code
bun run format:write
bun run format:check

# Run tests
bun run test              # Run all tests
bun run test:server       # Run server tests only
 bun run test:coverage     # Run tests with coverage
```

## Development Workflow

### First-time Setup

1. Fork the project repository
2. Clone to local
3. Install dependencies: `bun install`
4. Configure `.env.local`
5. Run `bun run dev`

### Daily Development

1. Modify code
2. Frontend auto-hot reloads, backend restarts automatically on changes
3. Test functionality
4. Commit code

### Database Changes

1. Modify `server/src/db/schema.ts`
2. Run `bun run db:generate` to generate migration files
3. Run `bun run db:migrate` to apply migrations

## Testing

The project uses different testing frameworks for client and server:

### Client Testing (Vitest)

Client tests use Vitest with jsdom environment for React component testing.

```bash
# Run client tests
cd client && bun run test

# Watch mode
cd client && bun run test:watch

# With coverage
cd client && bun run test:coverage
```

Test files location: `client/src/**/__tests__/*.test.ts`

### Server Testing (Bun)

Server tests use Bun's native test runner with in-memory SQLite database.

```bash
# Run server tests
cd server && bun run test

# With coverage
cd server && bun run test:coverage
```

Test files location:
- Unit tests: `server/src/**/__tests__/*.test.ts`
- Integration tests: `server/tests/integration/`
- Security tests: `server/tests/security/`

### Adding New Tests

When adding new features, please include corresponding tests:

1. **Client**: Add tests in `client/src/**/__tests__/*.test.ts`
2. **Server**: Add tests in `server/src/**/__tests__/*.test.ts` or `server/tests/`

## API Architecture

### Custom API Client

The project uses a custom HTTP client instead of Eden for type-safe API communication:

- **Location**: `client/src/api/client.ts`
- **Features**: Type-safe requests, error handling, auth token management
- **Usage**: All API calls go through the typed client

### Shared Types (@rin/api)

The `@rin/api` package provides shared TypeScript types for both client and server:

- **Location**: `packages/api/`
- **Purpose**: End-to-end type safety for API contracts
- **Usage**: Import types from `@rin/api` in both client and server code

When adding new API endpoints:
1. Define types in `packages/api/src/types.ts`
2. Implement server handler in `server/src/services/`
3. Client automatically gets type safety through shared types

## Troubleshooting

### Port Already in Use

If ports 5173 or 11498 are occupied, you can modify the configuration in `.env.local`:

```bash
# Modify frontend port (needs configuration in vite.config.ts)
# Modify backend port
bun run dev:server -- --port 11499
```

### Database Migration Failed

```bash
# Clean local database and re-migrate
rm -rf .wrangler/state
bun run db:migrate
```

### Configuration Files Not Generated

```bash
# Manually run configuration generation
bun run dev:setup
```

### GitHub OAuth Configuration

GitHub OAuth needs to be configured for local development:

1. Visit https://github.com/settings/developers
2. Create a new OAuth App
3. Authorization callback URL: `http://localhost:11498/user/github/callback`
4. Fill Client ID and Client Secret into `.env.local`

## Project Structure

```
.
├── client/                 # Frontend code (React + Vite)
│   ├── src/
│   │   ├── page/          # Page components
│   │   ├── api/           # API client
│   │   ├── components/    # React components
│   │   └── utils/         # Utility functions
│   └── package.json
├── server/                 # Backend code (Cloudflare Workers)
│   ├── src/
│   │   ├── services/      # Business services
│   │   ├── db/            # Database schema
│   │   ├── core/          # Router and core types
│   │   └── utils/         # Utility functions
│   ├── tests/             # Test files
│   └── package.json
├── packages/               # Shared packages
│   └── api/                # @rin/api - Shared API types
├── cli/                    # Rin CLI tool
│   └── bin/
│       └── rin.ts          # CLI entry point
├── scripts/                # Development scripts
│   ├── dev.ts             # Development server
│   ├── setup-dev.ts       # Configuration generation
│   └── db-migrate-local.ts    # Database migration
├── docs/                   # Documentation
├── .env.example            # Environment variable example
├── .env.local              # Local configuration (not committed to Git)
└── package.json
```

## Production Deployment

Please refer to the [Deployment Guide](./deploy.mdx) for production deployment procedures.

## Getting Help

- 📖 Full documentation: https://docs.openrin.org
- 💬 Discord: https://discord.gg/JWbSTHvAPN
- 🐛 Submit Issue: https://github.com/openRin/Rin/issues
