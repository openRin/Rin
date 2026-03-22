# Environment Variables Configuration Guide

Rin requires two types of environment variables: **Variables (plaintext)** and **Secrets (encrypted)**.

## Quick Reference

| Type | Storage | Purpose | Examples |
|------|---------|---------|----------|
| **Variables** | Plaintext in `wrangler.toml` | Configuration parameters, feature flags | Bucket name, cache mode |
| **Secrets** | Encrypted in Cloudflare | Sensitive credentials, keys | API keys, passwords, tokens |

---

## Variables (Plaintext)

These variables are stored in plaintext in `wrangler.toml` and control feature flags and basic parameters.

### Site Configuration

| Variable | Required | Description | Default | Config Key |
|----------|----------|-------------|---------|------------|
| `NAME` | No | Site name & title | Rin | `site.name` |
| `DESCRIPTION` | No | Site description | A lightweight personal blogging system | `site.description` |
| `AVATAR` | No | Site avatar URL | - | `site.avatar` |
| `PAGE_SIZE` | No | Default pagination size | 5 | `site.page_size` |
| `RSS_ENABLE` | No | Enable RSS link | false | `rss` |

:::tip
Site configuration can be modified via the **Settings Page** after deployment. Environment variables serve as initial defaults only.
:::

### Storage Configuration

| Variable | Required | Description | Default | Example |
|----------|----------|-------------|---------|---------|
| `S3_FOLDER` | Yes | Image storage path | images/ | `images/` |
| `S3_CACHE_FOLDER` | No | Cache file path | cache/ | `cache/` |
| `S3_BUCKET` | Yes | S3 bucket name | - | `my-bucket` |
| `S3_REGION` | Yes | S3 region (use 'auto' for R2) | - | `auto` |
| `S3_ENDPOINT` | Yes | S3 endpoint URL | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | No | Public access URL | Same as S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | No | Force path-style URLs | false | `false` |

### Feature Flags

| Variable | Required | Description | Default | Recommended |
|----------|----------|-------------|---------|-------------|
| `CACHE_STORAGE_MODE` | No | Cache mode: s3/database | s3 | **database** |
| `WEBHOOK_URL` | No | Comment notification webhook | - | - |
| `RSS_TITLE` | No | RSS feed title | - | - |
| `RSS_DESCRIPTION` | No | RSS feed description | - | - |

:::tip For New Users
We recommend setting `CACHE_STORAGE_MODE` to `database` to reduce deployment complexity without additional S3 cache configuration.
:::

---

## Secrets (Encrypted)

These sensitive values must be configured as **Cloudflare Workers Secrets**, entered via CLI during deployment or set in advance.

### Authentication (Configure at least one)

| Variable | Purpose | How to Obtain |
|----------|---------|---------------|
| `RIN_GITHUB_CLIENT_ID` | GitHub OAuth client ID | GitHub OAuth App settings |
| `RIN_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | GitHub OAuth App settings |
| `ADMIN_USERNAME` | Username for password login | Set yourself |
| `ADMIN_PASSWORD` | Password for password login | Set yourself |
| `JWT_SECRET` | JWT signing key (any random string) | Generate yourself |

:::warning Authentication Required
You must configure either **GitHub OAuth** or **Username/Password** authentication, otherwise you cannot access the admin panel.
:::

### S3 Storage Credentials

| Variable | Purpose | How to Obtain |
|----------|---------|---------------|
| `S3_ACCESS_KEY_ID` | S3 access key ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | S3 secret access key | R2 API Token |

### Cloudflare Deployment Credentials

| Variable | Purpose | How to Obtain |
|----------|---------|---------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API access token | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Right sidebar in Cloudflare Dashboard |

---

## GitHub Actions Variables

When using GitHub Actions for automated deployment, configure these in your Repository settings:

### Repository Variables (Settings → Secrets and variables → Variables)

```
NAME                    # Site name
DESCRIPTION             # Site description
AVATAR                  # Site avatar URL
PAGE_SIZE               # Pagination size
RSS_ENABLE              # Enable RSS
CACHE_STORAGE_MODE      # Cache mode (recommended: database)
R2_BUCKET_NAME          # Optional: if set, deploy derives S3_* from this bucket; if unset, no R2 bucket is auto-selected
WORKER_NAME             # Worker name (optional)
DB_NAME                 # D1 database name (optional)
```

### Repository Secrets (Settings → Secrets and variables → Secrets)

```
CLOUDFLARE_API_TOKEN          # Cloudflare API token
CLOUDFLARE_ACCOUNT_ID         # Cloudflare account ID
S3_ENDPOINT                   # S3/R2 endpoint URL
S3_ACCESS_HOST                # S3/R2 access domain
S3_BUCKET                     # S3 bucket name
S3_ACCESS_KEY_ID              # S3 access key ID
S3_SECRET_ACCESS_KEY          # S3 secret access key
RIN_GITHUB_CLIENT_ID          # GitHub OAuth ID (optional)
RIN_GITHUB_CLIENT_SECRET      # GitHub OAuth Secret (optional)
ADMIN_USERNAME                # Admin username (optional)
ADMIN_PASSWORD                # Admin password (optional)
JWT_SECRET                    # JWT secret key
```

---

## Local Development Environment

For local development, use `.env` file (see `.env.example`):

```bash
# Site Configuration
NAME="My Blog"
DESCRIPTION="A personal blog"

# S3 Storage (R2 or MinIO)
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx

# Authentication (GitHub or Username/Password)
RIN_GITHUB_CLIENT_ID=xxx
RIN_GITHUB_CLIENT_SECRET=xxx
# OR
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# Others
JWT_SECRET=random_secret_key
CACHE_STORAGE_MODE=database
```
