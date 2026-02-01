# Changelog

### v0.2.0 Updated on 2024-06-07

- Added `S3_CACHE_FOLDER` environment variable
- Updated the list of encrypted environment variables, keeping only the essential ones
- Encrypted variables can now be configured directly via GitHub
- Updated GitHub variable configuration, added encrypted variables that must be configured through GitHub (S3 storage for SEO index storage)
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are now prefixed with `RIN_` (`RIN_GITHUB_CLIENT_ID`, `RIN_GITHUB_CLIENT_SECRET`) to solve the issue where GitHub variables cannot start with `GITHUB_`. Variables configured through the Cloudflare panel (`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`) are not affected.

## Migration Guide

For normal version updates without special instructions, simply synchronize the forked repository.

### v0.2.0 Migration Guide

- Due to the introduction of SEO optimization, it is necessary to configure S3 storage environment variables in GitHub. Therefore, you need to additionally configure the following environment variables in GitHub (plain text, add to Variables):

```ini
SEO_BASE_URL=<SEO base URL for SEO indexing, defaults to FRONTEND_URL>
SEO_CONTAINS_KEY=<SEO indexing only includes links starting with SEO_BASE_URL or containing the SEO_CONTAINS_KEY keyword, defaults to empty>
S3_FOLDER=<Folder for storing S3 image resources, defaults to 'images/'>
S3_CACHE_FOLDER=<S3 cache folder (for SEO and high-frequency request caching), defaults to 'cache/'>
S3_BUCKET=<Name of the S3 bucket>
S3_REGION=<Region of the S3 bucket, use 'auto' if using Cloudflare R2>
S3_ENDPOINT=<S3 bucket endpoint address>
S3_ACCESS_HOST=<S3 bucket access address, without trailing '/'>
```

Additionally, add the following encrypted environment variables (encrypted, add to Secrets):

```ini
S3_ACCESS_KEY_ID=<Your S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<Your S3SecretAccessKey>
```

These environment variables were previously configured through the Cloudflare panel. Now they need to be migrated to GitHub. The new version's deployment GitHub Action will automatically upload them to Cloudflare, so you no longer need to configure these environment variables in the Cloudflare panel.