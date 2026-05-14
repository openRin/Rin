# Commit Message Convention

This document outlines the commit message convention for the Rin project. Following these conventions allows us to automatically generate changelogs and release notes.

## Format

Each commit message should follow this format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | A new feature | `feat(auth): add GitHub OAuth login` |
| `fix` | A bug fix | `fix(api): resolve CORS issue` |
| `docs` | Documentation changes | `docs(readme): update deployment guide` |
| `style` | Code style changes (formatting, semicolons, etc.) | `style: format with prettier` |
| `refactor` | Code refactoring | `refactor(db): optimize query performance` |
| `perf` | Performance improvements | `perf(cache): implement Redis caching` |
| `test` | Adding or updating tests | `test(api): add user authentication tests` |
| `chore` | Build process or auxiliary tool changes | `chore(deps): update dependencies` |
| `ci` | CI/CD changes | `ci: add release workflow` |
| `revert` | Reverting changes | `revert: undo breaking change` |

## Scope

The scope is optional and should indicate the area of the codebase affected:

- `api` - Backend API changes
- `client` - Frontend/client changes
- `db` - Database changes
- `auth` - Authentication related
- `ui` - UI components
- `deps` - Dependencies
- `config` - Configuration files
- `docs` - Documentation
- `release` - Release related

## Subject

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize the first letter
- No period at the end
- Maximum 50 characters

**Good examples:**
- `feat(auth): add password reset functionality`
- `fix(api): handle null response from database`
- `docs(readme): update installation instructions`

**Bad examples:**
- `feat: Added new feature` (past tense, capitalized)
- `fix: fixed the bug.` (past tense, period at end)
- `update stuff` (no type, vague description)

## Body

- Use imperative mood
- Wrap at 72 characters
- Explain **what** and **why**, not **how**
- Separate from subject with a blank line

Example:
```
feat(auth): implement JWT token refresh

Add automatic token refresh mechanism to prevent users from being
logged out unexpectedly. Tokens now refresh 5 minutes before expiry.

This improves user experience by maintaining sessions seamlessly.
```

## Footer

- Reference issues and PRs: `Closes #123`, `Fixes #456`
- Breaking changes: `BREAKING CHANGE: description`

Example:
```
feat(api): change response format for user endpoint

BREAKING CHANGE: The user endpoint now returns user data wrapped in
a `data` field instead of returning it directly. Update your client
code accordingly.

Closes #789
```

## Examples

### Feature
```
feat(articles): add markdown editor with preview

Implement a split-pane markdown editor with live preview using
Monaco Editor. Supports syntax highlighting and image uploads.

Closes #234
```

### Bug Fix
```
fix(ui): resolve mobile navigation menu overlap

The navigation menu was overlapping with content on screens smaller
than 768px. Adjusted z-index and positioning to fix the issue.

Fixes #567
```

### Documentation
```
docs(deploy): add Cloudflare setup guide

Add comprehensive guide for setting up Cloudflare Workers, D1
database, and R2 storage for new deployments.
```

### Breaking Change
```
feat(auth): migrate to new OAuth provider

BREAKING CHANGE: The GitHub OAuth implementation has been replaced
with a generic OAuth2 provider. Environment variables have changed:
- GITHUB_CLIENT_ID → OAUTH_CLIENT_ID
- GITHUB_CLIENT_SECRET → OAUTH_CLIENT_SECRET

Migration guide: https://docs.example.com/migration/v2
```

## Commit Message Linting

We recommend using commitlint to enforce these conventions:

```bash
# Install commitlint
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# Create commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

## Why?

- **Automatic Changelogs**: Release notes can be auto-generated
- **Clear History**: Easy to understand what changed and why
- **Semantic Versioning**: Helps determine version bumps (feat=minor, fix=patch, breaking=major)
- **Better Collaboration**: Consistent format makes reviews easier

## Tools

- **Commitizen**: Interactive commit message builder
  ```bash
  npm install -g commitizen
  git cz  # Instead of git commit
  ```

- **VS Code Extension**: "Conventional Commits" for autocompletion

## Questions?

If you're unsure about the commit type or format, ask in your PR or refer to existing commits in the repository.
