# Rin Migration Guide (v0.3.0)

This guide helps existing Rin users migrate to the latest version.

## Overview of Changes

Version 0.3.0 includes significant architectural changes:

1. **Framework Migration**: Replaced ElysiaJS with a custom lightweight framework
2. **API Changes**: New API client interface
3. **Login Methods**: Added support for username/password authentication
4. **OAuth Changes**: GitHub OAuth variable names updated
5. **Performance Improvements**: Significant performance enhancements

## Migration Steps

### Step 1: Sync Fork

1. Go to your forked repository on GitHub
2. Click the **"Sync fork"** button
3. Click **"Update branch"** to merge changes

### Step 2: Update Environment Variables

#### Required Changes

**GitHub OAuth Variables (if using GitHub login)**

Old variable names are deprecated:

```
GITHUB_CLIENT_ID      → RIN_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET  → RIN_GITHUB_CLIENT_SECRET
```

**Steps**:
1. Go to Settings → Secrets and variables → Actions
2. Add new Secrets with the `RIN_` prefix
3. (Optional) Delete old Secrets

#### Optional: Add Username/Password Login

If you prefer simple username/password authentication over GitHub OAuth:

1. Add the following Secrets:
    - `ADMIN_USERNAME`: Your desired username
    - `ADMIN_PASSWORD`: Your desired password

### Step 3: Remove Pages (Optional but Recommended)

Starting from 0.3.0, Rin now uses Workers to host static assets instead of Cloudflare Pages. Follow these steps to migrate:

1. **Unbind Pages Domain**
   - Go to Cloudflare Dashboard → Pages
   - Select your Pages project → Custom domains
   - Remove the bound domain

2. **Bind Domain to Worker**
   - Go to Cloudflare Dashboard → Workers & Pages
   - Select your Worker (`rin-server`)
   - Click "Triggers" → "Add Custom Domain"
   - Enter your domain and save

3. **Clean Up Extra Domain Bindings**
   - Check the Worker's custom domain list
   - Remove unnecessary bindings (e.g., `seo/*`, `sub/*`, etc.)

4. **Update GitHub OAuth Callback**
   - Go to GitHub → Settings → Developer settings → OAuth Apps
   - Find your OAuth App
   - Change the Authorization callback URL from:
     - `https://<worker-domain>/user/github/callback`
   - To:
     - `https://<your-domain>/api/user/github/callback`

### Step 4: Update Cloudflare API Key Permissions

Ensure your Cloudflare API Token has the following permissions:
- **Cloudflare Workers**:Edit
- **Account**:Read
- **D1**:Edit
- **R2**:Edit (if using R2 storage)

![1000000663](/cloudflare-api-key-en.png)

### Step 5: Deploy

1. Go to the Actions tab in your repository
2. Select the **"Deploy"** workflow
3. Click **"Run workflow"**

### Step 6: Verify Deployment

1. Visit your frontend URL
2. Test the login functionality
3. Check if existing articles are accessible
4. Verify images load correctly

## Breaking Changes Summary

### API Client Interface

**Old code** (no longer supported):
```typescript
const feeds = await client.feed.index.get({ query: { page: 1 } });
```

**New code**:
```typescript
const feeds = await client.feed.list({ page: 1 });
```

If you have custom frontend code using the old API, please update accordingly.

### Authentication Flow

- **Old**: Backend redirects to frontend callback URL
- **New**: Standalone `/login` page with dedicated login flow

### Environment Variable Changes

| Old Name | New Name | Required |
|----------|----------|----------|
| `GITHUB_CLIENT_ID` | `RIN_GITHUB_CLIENT_ID` | Optional* |
| `GITHUB_CLIENT_SECRET` | `RIN_GITHUB_CLIENT_SECRET` | Optional* |
| - | `ADMIN_USERNAME` | Optional* |
| - | `ADMIN_PASSWORD` | Optional* |

*At least one login method must be configured

## Post-Migration

### Try New Features

1. **Profile Management**: Visit `/profile` to update avatar and username
2. **Performance Boost**: Experience faster cold starts and lower CPU usage
3. **Better Login Experience**: New standalone login page with improved focus handling

### Cleanup (Optional)

After successful migration, you can:

1. Remove deprecated environment variables
2. Delete old preview deployments if no longer needed
3. Update custom scripts to use the new API interface

## Troubleshooting

### "Version Mismatch" Error

**Solution**: Ensure git tags match the package.json version. Syncing should handle this automatically.

### "Cannot Login"

**Solution**:
1. Verify at least one login method is configured (GitHub OAuth or username/password)
2. Check Secrets are set correctly
3. Try clearing browser cache

### "Images Not Loading"

**Solution**:
1. Check S3/R2 configuration
2. Verify `S3_ACCESS_HOST` is set correctly
3. Check R2 bucket permissions

## Rollback (if needed)

If migration fails and you need to rollback:

1. Restore previous git tag: `git checkout v0.2.x`
2. Force push to main (⚠️ destructive): `git push origin HEAD:main --force`
3. Redeploy from Actions

## Need Help?

- 📖 [Full Documentation](https://rin-docs.xeu.life)
- 🐛 [GitHub Issues](https://github.com/openRin/Rin/issues)
- 💬 [GitHub Discussions](https://github.com/openRin/Rin/discussions)

---

*Last updated: 2025-02-08*