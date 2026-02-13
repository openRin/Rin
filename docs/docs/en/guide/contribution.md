# Contribute to Rin

We are happy to accept your patches and contributions to this project. You just need to follow some small guidelines.

## Commit-msg hooks

We have a sample commit-msg hook in `scripts/commit-msg.sh`. Please run the following command to set it up:

```sh
ln -s ../../scripts/commit-msg.sh commit-msg
```

On Windows, copy the `commit-msg.sh` file directly to `.git/hooks/commit-msg`.

```powershell
cp .\scripts\commit-msg.sh .\.git\hooks\commit-msg
```

This will run the following checks before each commit:

1. **Type checking** - `bun run check` validates TypeScript types across all packages
2. **Linting** - checks code formatting and style
3. **Commit message format** - verifies the commit message starts with one of: `feat|chore|fix|docs|ci|style|test|pref`

:::warning Important
The hook also runs tests. Make sure all tests pass before committing:
```sh
bun run test
```
:::

If you want to skip the hook (not recommended), run `git commit` with the `--no-verify` option.

## Setting up your development environment

1. Fork & Clone the repository

2. Install [Node](https://nodejs.org/en/download/package-manager) & [Bun](https://bun.sh/)

3. Install dependencies
    ```sh
    bun i
    ```

4. Fill in the required configuration in `.env.local` file.

:::tip
Typically, you only need to fill in `AVATAR`, `NAME` and `DESCRIPTION`.
For GitHub OAuth, you need to create a separate OAuth App with a callback address of `http://localhost:11498/user/github/callback`
:::

5. Run the setup script to generate configuration files
```sh
bun run dev:setup
```

This will automatically generate `wrangler.toml` and `.dev.vars` files based on your `.env.local` configuration.

6. Perform the database migration
```sh
bun run db:migrate
```

7. (Optional) Configure S3/R2 for image upload

If you want to use the image upload feature, fill in the S3 configuration in `.env.local`:
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

8. Start the development server
    ```sh
    bun run dev
    ```

9. For better control of the development server, you can run the client and server dev commands in two separate
   terminals:
    ```sh
    # tty1
    bun run dev:client
    
    # tty2
    bun run dev:server
    ```

## Testing Requirements

Before submitting a pull request, please ensure all tests pass:

```sh
# Run all tests
bun run test

# Run type checking
bun run check

# Run formatting check
bun run format:check
```

### Adding Tests for New Features

When adding new API endpoints:
1. Define types in `packages/api/src/types.ts` (shared between client and server)
2. Add server tests in `server/src/**/__tests__/*.test.ts`
3. Add client tests in `client/src/**/__tests__/*.test.ts` if applicable

## Committing Changes

1. for simple patches, they can usually be reviewed within 10 minutes during the day in the UTC+8 time zone. 2.

2. Do not force push minor changes after the PR is ready for review. Doing so forces maintainers to re-read your entire
   PR, which delays the review process. 3.

3. Always keep the CI green.

4. If the CI fails on your PR, do not push it. Even if you don't think it's the patch's fault. If something else is
   breaking the CI, help fix the root cause before you push.

*Start writing code happily!*

## Code review

All commits, including those from project members, need to be reviewed. We use GitHub pull requests for this purpose.
For more information on using pull requests, see the GitHub Help.