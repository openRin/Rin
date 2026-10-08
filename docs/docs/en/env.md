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

Rin supports three object storage backends: **Supabase Storage**, **Cloudflare R2**, and **any S3-compatible service** (including R2's S3 API, MinIO, AWS S3). Images, favicons, sitemap, and RSS cache all use the same backend.

#### Backend Selection

| Variable | Required | Description | Default | Example |
|----------|----------|-------------|---------|---------|
| `STORAGE_PROVIDER` | No | Backend type: `supabase`/`r2`/`s3` | Auto-detected | `supabase` |

When left unset it is auto-detected, so **existing deployments keep working**: with `SUPABASE_URL` + `SUPABASE_STORAGE_BUCKET` → `supabase`; otherwise an R2 binding → `r2`; otherwise `s3`.

#### Option 1: Supabase Storage

Create a Storage bucket in the Supabase dashboard, then configure:

| Variable | Required | Description | Default | Example |
|----------|----------|-------------|---------|---------|
| `SUPABASE_URL` | Yes | Project URL | - | `https://xxxx.supabase.co` |
| `SUPABASE_STORAGE_BUCKET` | Yes | Storage bucket name | - | `rin` |
| `SUPABASE_STORAGE_PUBLIC` | No | Whether the bucket is public | `false` | `true` |

About `SUPABASE_STORAGE_PUBLIC`:

- `true` — images are served directly by the Supabase CDN, **skipping Worker round-trips. Recommended.**
- `false` — private bucket; images are proxied through the Worker's `/api/blob/*` route (service_role bypasses RLS).

:::tip
Rin talks to Supabase through the **Storage REST API** (`/storage/v1/object/{bucket}/{path}`), which only needs the Project URL and a service_role key — **no S3 credentials need to be configured on the Supabase side.**
:::

#### Option 2: S3-Compatible Storage (Cloudflare R2 / MinIO / AWS S3)

| Variable | Required | Description | Default | Example |
|----------|----------|-------------|---------|---------|
| `S3_FOLDER` | Yes | Image storage path | images/ | `images/` |
| `S3_CACHE_FOLDER` | No | Cache file path | cache/ | `cache/` |
| `S3_BUCKET` | Yes | S3 bucket name | - | `my-bucket` |
| `S3_REGION` | Yes | S3 region (use 'auto' for R2) | - | `auto` |
| `S3_ENDPOINT` | Yes | S3 endpoint URL | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | No | Public access URL | Same as S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | No | Force path-style URLs | false | `false` |

:::tip
With Cloudflare R2, setting `R2_BUCKET_NAME` + `CLOUDFLARE_ACCOUNT_ID` lets the deploy generate the R2 binding and derive the S3 settings automatically.
:::

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

Only needed when `STORAGE_PROVIDER` is `s3`:

| Variable | Purpose | How to Obtain |
|----------|---------|---------------|
| `S3_ACCESS_KEY_ID` | S3 access key ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | S3 secret access key | R2 API Token |

### Supabase Storage Credentials

Only needed when `STORAGE_PROVIDER` is `supabase`:

| Variable | Purpose | How to Obtain |
|----------|---------|---------------|
| `SUPABASE_SECRET_KEY` | Elevated key; bypasses RLS and can read/write private buckets | Supabase Dashboard → Project Settings → API |

`SUPABASE_SECRET_KEY` accepts two formats, and the code adapts the auth headers based on the key shape:

| Format | Source | Notes |
|--------|--------|-------|
| `sb_secret_...` | API → **Secret keys** | Recommended. Not a JWT, sent via the `apikey` header only |
| `eyJ...` (JWT) | API → **Legacy keys** → service_role | Legacy; sent via both `apikey` and `Authorization: Bearer` |

:::tip About the publishable key
Supabase also offers `sb_publishable_...` (the new name for the `anon` key), but it **respects Row Level Security** and therefore cannot bypass policies to reach a private bucket. It does not apply to this project's server-side storage access. The replacement for `service_role` is the **secret key**, not the publishable key.
:::

:::warning
The secret key (like the legacy `service_role`) grants elevated database access. Use it **only** on the Worker side — never ship it to the client or expose it in frontend code. Supabase plans to deprecate the legacy `anon` / `service_role` keys by the end of 2026, so prefer the new secret key.
:::

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
NAME                       # Site name
DESCRIPTION                # Site description
AVATAR                     # Site avatar URL
PAGE_SIZE                  # Pagination size
RSS_ENABLE                 # Enable RSS
CACHE_STORAGE_MODE         # Cache mode (recommended: database)
STORAGE_PROVIDER           # Storage backend: supabase / r2 / s3 (optional, auto-detected if unset)
SUPABASE_URL               # Supabase project URL (required when provider=supabase)
SUPABASE_STORAGE_BUCKET    # Supabase Storage bucket name
SUPABASE_STORAGE_PUBLIC    # Whether the bucket is public (true / false)
R2_BUCKET_NAME             # Optional: if set, deploy derives S3_* from this bucket; if unset, no R2 bucket is auto-selected
WORKER_NAME                # Worker name (optional)
DB_NAME                    # D1 database name (optional)
```

### Repository Secrets (Settings → Secrets and variables → Secrets)

```
CLOUDFLARE_API_TOKEN          # Cloudflare API token
CLOUDFLARE_ACCOUNT_ID         # Cloudflare account ID
SUPABASE_SECRET_KEY          # Supabase secret key (required when provider=supabase)
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

# Or Supabase Storage
# STORAGE_PROVIDER=supabase
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_STORAGE_BUCKET=rin
# SUPABASE_STORAGE_PUBLIC=true
# SUPABASE_SECRET_KEY=sb_secret_xxx

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
