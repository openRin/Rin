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
- ✅ Generate `client/.env` frontend environment variables
- ✅ Generate `.dev.vars` sensitive information file
- ✅ Run database migrations
- ✅ Start backend service (port 11498)
- ✅ Start frontend service (port 5173)

Visit http://localhost:5173 to start developing!

## Environment Variable Configuration

All configurations are centralized in the `.env.local` file:

### Frontend Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `API_URL` | Yes | Backend API address | `http://localhost:11498` |
| `NAME` | Yes | Website name | `My Blog` |
| `AVATAR` | Yes | Avatar URL | `https://...` |
| `DESCRIPTION` | No | Website description | `A blog` |
| `PAGE_SIZE` | No | Pagination size | `5` |
| `RSS_ENABLE` | No | Enable RSS | `false` |

### Backend Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `FRONTEND_URL` | Yes | Frontend address | `http://localhost:5173` |
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
bun run typecheck

# Format code
bun run format:write
bun run format:check
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
├── client/                 # Frontend code
│   ├── src/
│   │   ├── page/          # Page components
│   │   ├── state/         # State management
│   │   └── utils/         # Utility functions
│   └── package.json
├── server/                 # Backend code
│   ├── src/
│   │   ├── services/      # Business services
│   │   ├── db/            # Database
│   │   └── utils/         # Utility functions
│   └── package.json
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
