# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file contains **detailed** changelog information for each release.
For a quick overview of changes, see the [GitHub Releases](https://github.com/openRin/Rin/releases) page
which automatically generates release notes from commit messages.

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [v0.2.0] - 2024-06-07

### Overview
This release focuses on simplifying deployment and configuration management by migrating environment variables from Cloudflare panel to GitHub Secrets/Variables.

### Added
- **SEO Caching**: Added `S3_CACHE_FOLDER` environment variable for SEO pre-rendering cache storage
- **GitHub-based Configuration**: Environment variables can now be configured directly through GitHub Secrets/Variables instead of Cloudflare panel
- **Automated Release Workflow**: Added automated release process with version validation and changelog generation
- **Version Consistency Checks**: CI now validates version consistency across all package.json files

### Changed
- **OAuth Variable Names**: Changed GitHub OAuth variable names to use `RIN_` prefix to comply with GitHub's naming restrictions:
  - `GITHUB_CLIENT_ID` → `RIN_GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET` → `RIN_GITHUB_CLIENT_SECRET`
- **Deployment Triggers**: Deployment now triggers only on version tags (e.g., `v0.2.0`) instead of branch pushes
- **Environment Management**: Migrated all environment variable management from Cloudflare panel to GitHub

### Migration Guide

#### For Existing Users

If you're upgrading from v0.1.0, follow these steps:

1. **Add new environment variables to GitHub Variables**:
   ```ini
   SEO_BASE_URL=<SEO base URL, defaults to FRONTEND_URL>
   SEO_CONTAINS_KEY=<SEO filter keyword, optional>
   S3_FOLDER=<S3 images folder, default: 'images/'>
   S3_CACHE_FOLDER=<S3 cache folder, default: 'cache/'>
   S3_BUCKET=<S3 bucket name>
   S3_REGION=<S3 region, use 'auto' for Cloudflare R2>
   S3_ENDPOINT=<S3 endpoint URL>
   S3_ACCESS_HOST=<S3 access URL>
   ```

2. **Add new secrets to GitHub Secrets**:
   ```ini
   S3_ACCESS_KEY_ID=<Your S3 Access Key ID>
   S3_SECRET_ACCESS_KEY=<Your S3 Secret Access Key>
   ```

3. **Update OAuth variables** (if using GitHub OAuth):
   - Rename `GITHUB_CLIENT_ID` to `RIN_GITHUB_CLIENT_ID`
   - Rename `GITHUB_CLIENT_SECRET` to `RIN_GITHUB_CLIENT_SECRET`

4. **Remove from Cloudflare** (optional):
   - These variables are now managed through GitHub and will be automatically deployed
   - You can remove them from Cloudflare Workers environment variables if they exist there

### Technical Details

#### Deployment Changes
- Previous: Deployment triggered on every push to `main`, `dev`, or `fix/*` branches
- Now: Deployment only triggers on version tags (e.g., `v0.2.0`)
- Benefit: More controlled releases, prevents accidental deployments

#### Configuration Changes
- Previous: Sensitive variables configured in Cloudflare panel
- Now: All variables configured in GitHub Secrets/Variables
- Benefit: Single source of truth, better version control integration

### Known Issues
- None reported

### Contributors
- Thanks to all contributors who helped with this release!

## [v0.1.0] - 2024-XX-XX

### Added
- 🎉 Initial release of Rin blog platform
- **Backend**: Cloudflare Workers with Elysia framework
- **Frontend**: React + Vite + Tailwind CSS hosted on Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite-based edge database)
- **Storage**: Cloudflare R2 for image storage
- **Authentication**: GitHub OAuth integration
- **Editor**: Monaco Editor with Markdown support
- **Comments**: Comment system with Webhook notifications
- **RSS**: RSS feed generation
- **SEO**: SEO optimization with pre-rendering
- **i18n**: Multi-language support
- **Friend Links**: Automated health checks for friend links (every 20 minutes)

### Features
- Real-time local saving for article drafts
- Image upload and management
- Article tagging and categorization
- Responsive design
- Dark mode support
- Scheduled tasks via Cloudflare Cron Triggers

[Unreleased]: https://github.com/openRin/Rin/compare/v0.2.0...HEAD
[v0.2.0]: https://github.com/openRin/Rin/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/openRin/Rin/releases/tag/v0.1.0
