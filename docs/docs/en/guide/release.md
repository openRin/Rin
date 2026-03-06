# Release Process

This document describes the release process for the Rin project.

## Overview

Rin uses [Semantic Versioning](https://semver.org/) and follows a structured release workflow to ensure stability and consistency.

**Key Features:**
- 🤖 **Automated Release Notes**: Generated from conventional commit messages
- 📝 **Detailed Changelog**: Maintained in `CHANGELOG.md` with migration guides
- ✅ **Automated Validation**: CI checks version consistency and runs tests
- 🚀 **Automated Deployment**: Deploys to Cloudflare on version tags

## Version Format

Versions follow the format `MAJOR.MINOR.PATCH`:

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Pre-release versions can be tagged with a hyphen, e.g., `v1.0.0-beta.1`.

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This allows us to automatically generate release notes.

### Quick Reference

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add GitHub OAuth` |
| `fix` | Bug fix | `fix(api): resolve CORS issue` |
| `docs` | Documentation | `docs(readme): update guide` |
| `refactor` | Code refactoring | `refactor(db): optimize queries` |
| `perf` | Performance | `perf(cache): add Redis` |
| `chore` | Maintenance | `chore(deps): update packages` |

See [Commit Convention](./commit-convention.md) for detailed guidelines.

## Release Workflow

### 1. Ensure All Changes Are Ready

- [ ] All features/fixes merged to `main`
- [ ] All commits follow [conventional commit format](./commit-convention.md)
- [ ] Tests passing (`bun run check`, `bun run build`)

### 2. Run the Release Script

```bash
# Bump patch version (0.1.0 -> 0.1.1)
bun cli/bin/rin.ts release patch

# Bump minor version (0.1.0 -> 0.2.0)
bun cli/bin/rin.ts release minor

# Bump major version (0.1.0 -> 1.0.0)
bun cli/bin/rin.ts release major

# Or set a specific version
bun cli/bin/rin.ts release 1.2.3

# Pre-release version
bun cli/bin/rin.ts release 0.3.0-rc.1
```

The script will:
1. ✅ Run pre-release checks (typecheck, build, branch/changelog validation)
2. 📝 Update version in every workspace `package.json`
3. 🔗 Append the release link for the target version in `CHANGELOG.md`
4. 🏷️ Create git commit and tag

**Important**: The script does not write the changelog body for you; it expects a matching version section to already exist in `CHANGELOG.md`.

### 3. Review and Edit CHANGELOG

After running the release script:

```bash
# Open CHANGELOG.md and complete the new version section
# Add detailed descriptions, migration guides, etc.
nano CHANGELOG.md  # or your preferred editor

# If you made changes, amend the commit
git add CHANGELOG.md
git commit --amend --no-edit
```

### 4. Dry Run (Optional)

To preview changes without applying them:

```bash
bun cli/bin/rin.ts release minor --dry-run
```

### 5. Push the Release

```bash
# Push the commit
git push origin main

# Push the tag (triggers release workflow)
git push origin v0.3.0-rc.1
```

### 6. Automated Release Process

Once the tag is pushed, GitHub Actions automatically:

1. **🔍 Validation** (`release.yml`)
   - Validates version consistency
   - Runs typecheck and build

2. **📝 Release Notes Generation** (`release.yml`)
   - Categorizes commits by type (features, fixes, etc.)
   - Extracts detailed notes from CHANGELOG.md
   - Creates GitHub Release with formatted notes
   - Attaches `build-v<version>-cloudflare.tar.gz` as a release asset

3. **🚀 Deployment** (`deploy.yml`)
   - Validates deployment version
   - Deploys to Cloudflare Workers
   - Runs database migrations

## Release Notes Structure

GitHub Releases will contain:

```markdown
## What's Changed

**Full Changelog**: v0.1.0...v0.2.0

### 🚀 Features
- feat(auth): add GitHub OAuth login (abc1234)
- feat(ui): implement dark mode (def5678)

### 🐛 Bug Fixes
- fix(api): resolve CORS issue (ghi9012)

### 📋 Detailed Changelog
[Content from CHANGELOG.md for this version]

---

## 🆙 Upgrade Guide
...
```

## For Fork Users

### Deploying from the release artifact

If you do not want to rebuild in your own repository, you can deploy directly from the GitHub Release asset:

1. Open the GitHub Release page for the target version
2. Find `build-v<version>-cloudflare.tar.gz` under Assets
3. Copy its download URL
4. Trigger `deploy.yml` manually and pass that URL as `artifact_url`

That URL is exactly what the `artifact_url` input in `deploy.yml` is meant to consume.

### Option 1: Sync Fork (Recommended)

1. Go to your forked repository on GitHub
2. Click **"Sync fork"** button
3. Review the [CHANGELOG.md](./changelog.md) for migration steps
4. Update environment variables if needed
5. The deployment will run automatically if configured

### Option 2: Manual Update

```bash
# Add upstream remote
git remote add upstream https://github.com/openRin/Rin.git

# Fetch latest changes
git fetch upstream

# Merge into your main branch
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

## Release Checklist

Before creating a release:

- [ ] All tests pass (`bun run check`, `bun run build`)
- [ ] All commits follow conventional format
- [ ] CHANGELOG.md section prepared for the target version
- [ ] Migration guide included (for breaking changes)
- [ ] Documentation updated (if needed)

After pushing the tag:

- [ ] GitHub Release created successfully
- [ ] Release notes look correct
- [ ] Deployment completed successfully

## Emergency Releases

For critical bugs requiring immediate release:

```bash
# Create hotfix branch from latest tag
git checkout -b fix/critical-bug v0.2.0

# Apply fix and commit with conventional format
git commit -m "fix(api): resolve critical security issue"

# Run release script
bun cli/bin/rin.ts release patch

# Push (no need to merge to main for hotfixes)
git push origin fix/critical-bug
git push origin v0.2.1
```

## Troubleshooting

### Version Mismatch Error

**Problem**: CI shows "Version mismatch" error

**Solution**:
1. Ensure git tag matches `package.json` version
2. The release script handles this automatically
3. For manual releases, ensure: `git tag v1.0.0` matches `"version": "1.0.0"` in package.json

### Empty Release Notes

**Problem**: GitHub Release has no changes listed

**Solution**:
1. Ensure commits follow conventional format (`feat:`, `fix:`, etc.)
2. Check that commits exist between tags: `git log v0.1.0..v0.2.0 --oneline`
3. Non-conventional commits won't appear in categorized lists

### Failed Deployment

**Problem**: Deployment fails after release

**Solution**:
1. Check GitHub Actions logs for specific errors
2. Verify all required secrets are configured
3. Check Cloudflare dashboard for deployment errors
4. Manually trigger deployment from Actions tab if needed

### CHANGELOG.md Conflicts

**Problem**: Merge conflicts in CHANGELOG.md

**Solution**:
1. Keep both sections
2. Reorder chronologically (newest first)
3. Remove duplicate entries

## Best Practices

### Writing Good Commits

✅ **Good**:
```
feat(auth): implement JWT token refresh

Add automatic token refresh to prevent session timeouts.
Tokens refresh 5 minutes before expiry.

Closes #123
```

❌ **Bad**:
```
update auth stuff
fixed bug
```

### Maintaining CHANGELOG

- Keep [Unreleased] section updated during development
- Write migration guides for breaking changes
- Include code examples in migration sections
- Credit contributors when applicable

### Version Bumping

- **Patch** (0.0.1): Bug fixes only
- **Minor** (0.1.0): New features, backward compatible
- **Major** (1.0.0): Breaking changes

When in doubt, use **minor** for new features.

## Questions?

- 📖 Read [Commit Convention](./commit-convention.md) for commit guidelines
- 🐛 Report issues: [GitHub Issues](https://github.com/openRin/Rin/issues)
- 💬 Join discussions in our community
