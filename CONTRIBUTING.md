# Contribute to Rin

English | [简体中文](./CONTRIBUTING_zh_CN.md)

We are happy to accept your patches and contributions to this project. You just need to follow some small guidelines.

# Commit-msg hooks

We have a sample commit-msg hook in `scripts/commit-msg.sh`. Please run the following command to set it up:

```sh
ln -s ../../scripts/commit-msg.sh commit-msg
```

On Windows, copy the `commit-msg.sh` file directly to `.git/hooks/commit-msg`.

```powershell
cp .\scripts\commit-msg.sh .\.git\hooks\commit-msg
```

This will run the following checks before each commit:

1. `tsc` Checks the code for syntax errors and unused variables and references.
2. check that the commit message starts with one of the following: feature|chore|fix|docs|ci|style|test|pref

If you want to skip the hook, run `git commit` with the `--no-verify` option.

# Setting up your development environment

1. Fork & Clone the repository

2. Install [Node](https://nodejs.org/en/download/package-manager) & [Bun](https://bun.sh/)

3. Install dependencies
    ```sh
    bun i
    ```

4. Copy the `wrangler.example.toml` file to `wrangler.toml` and fill in the necessary information
   > [!TIP]   
   > Normally, you only need to fill in the `database_name` and `database_id` fields.\
   > S3 configuration is not required, but if you want to use the image upload feature, you need to fill in the S3
   configuration.

5. Copy the `client/.env.example` file to `client/.env` and change the necessary configuration.
   > [!TIP]   
   > Typically, you only need to fill in `AVATAR`, `NAME` and `DESCRIPTION`.

6. Perform the database migration
   > [!TIP]  
   > If your database name (`database_name` in `wrangler.toml`) is not `rin`\
   > Please modify the `DB_NAME` field in `scripts/dev-migrator.sh` before performing the migration
    ```sh
    bun m
    ```

7. Configuring the `.dev.vars' file
   Copy `.dev.example.vars` to `.dev.vars` and fill in the required information
   > [!TIP]   
   > Typically, you need to fill in the `RIN_GITHUB_CLIENT_ID` and `RIN_GITHUB_CLIENT_SECRET` as well as
   the `JWT_SECRET` fields.
   > In the development environment, you need to create a separate GitHub OAuth service with a callback address
   of `http://localhost:11498/user/github/callback` \
   > If you have changed the listening port of the server manually, please also change the port number in the callback
   address.

8. Start the development server
    ```sh
    bun dev
    ```

9. For better control of the development server, you can run the client and server dev commands in two separate
   terminals:
    ```sh
    # tty1
    bun dev:client
    
    # tty2
    bun dev:server
    ```

# Committing Changes

1. for simple patches, they can usually be reviewed within 10 minutes during the day in the UTC+8 time zone. 2.

2. Do not force push minor changes after the PR is ready for review. Doing so forces maintainers to re-read your entire
   PR, which delays the review process. 3.

3. Always keep the CI green.

4. If the CI fails on your PR, do not push it. Even if you don't think it's the patch's fault. If something else is
   breaking the CI, help fix the root cause before you push.

*Start writing code happily!*

# Code review

All commits, including those from project members, need to be reviewed. We use GitHub pull requests for this purpose.
For more information on using pull requests, see the GitHub Help.