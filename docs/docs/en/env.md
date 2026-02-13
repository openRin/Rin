# Environment Variables List

## Frontend Environment Variables List

| Name         | Required | Description                             | Default Value | Example Value                                       |
|--------------|----------|-----------------------------------------|---------------|----------------------------------------------------|
| AVATAR       | Yes      | Avatar URL for the top left of the site | None          | https://avatars.githubusercontent.com/u/36541432   |
| NAME         | Yes      | Name & Title for the top left of the site | None          | Xeu                                                |
| DESCRIPTION  | No       | Description for the top left of the site | None          | Omnivore                                           |
| PAGE_SIZE    | No       | Default pagination limit                | 5             | 5                                                  |
| RSS_ENABLE   | No       | Enable RSS (displays RSS link at the bottom of the site if enabled) | false | true                                              |

**Deployment Environment Variables**

:::caution
The following environment variables are required for deployment to Cloudflare Pages and cannot be modified.
:::

| Name                     | Value                                                     | Description                   |
|--------------------------|-----------------------------------------------------------|-------------------------------|
| SKIP_DEPENDENCY_INSTALL  | true                                                      | Skip the default npm install command |
| UNSTABLE_PRE_BUILD       | asdf install bun latest && asdf global bun latest && bun i | Install and use Bun for dependency installation |

## Backend Environment Variables List

**Plaintext Environment Variables**

:::note
The following variables can remain unencrypted in Cloudflare Workers.
:::

| Name              | Required | Description                                           | Default Value  | Example Value                                                     |
|-------------------|----------|-------------------------------------------------------|----------------|-------------------------------------------------------------------|
| FRONTEND_URL      | Temporarily required | Required for including comment article link in comment notification Webhook, can be left blank | None          | https://xeu.life                                                  |
| S3_FOLDER         | Yes      | File path for storing resources when uploading images | None           | images/                                                           |
| S3_BUCKET         | Yes      | Name of the S3 bucket                                 | None           | images                                                            |
| S3_REGION         | Yes      | Region of the S3 bucket, use 'auto' for Cloudflare R2 | None           | auto                                                              |
| S3_ENDPOINT       | Yes      | Endpoint address of the S3 bucket                     | None           | https://1234567890abcdef1234567890abcd.r2.cloudflarestorage.com   |
| WEBHOOK_URL       | No       | Target address for sending Webhook notifications when a new comment is added | None  | https://webhook.example.com/webhook                               |
| S3_ACCESS_HOST    | No       | Access address of the S3 bucket                       | S3_ENDPOINT    | https://image.xeu.life                                            |
| S3_CACHE_FOLDER   | No       | S3 cache folder (for SEO and high-frequency request caching) | cache/  | cache/                                                            |

**Encrypted Environment Variables**

:::note
All of the following variables are required (except Webhook) and must be encrypted after debugging in Cloudflare Workers. Unencrypted variables will be cleared during deployment if not listed in `wrangler.toml`.
:::

| Name                     | Description                                              | Example Value                                                   |
|--------------------------|----------------------------------------------------------|-----------------------------------------------------------------|
| RIN_GITHUB_CLIENT_ID     | Client ID for GitHub OAuth (optional, alternative to username/password) | Ux66poMrKi1k11M1Q1b2                                            |
| RIN_GITHUB_CLIENT_SECRET | Client secret for GitHub OAuth (optional, alternative to username/password) | 1234567890abcdef1234567890abcdef12345678                        |
| ADMIN_USERNAME           | Username for username/password login (optional, alternative to GitHub OAuth) | admin                                                           |
| ADMIN_PASSWORD           | Password for username/password login (optional, alternative to GitHub OAuth) | your_secure_password                                            |
| JWT_SECRET               | Secret key required for JWT authentication, can be any regular format password | J0sT%Ch@nge#Me1                                                |
| S3_ACCESS_KEY_ID         | KEY ID required for accessing the S3 bucket, for Cloudflare R2 use an API token ID with R2 edit permissions | 1234567890abcdef1234567890abcd                                  |
| S3_SECRET_ACCESS_KEY     | Secret required for accessing the S3 bucket, for Cloudflare R2 use an API token with R2 edit permissions | 1234567890abcdef1234567890abcd|