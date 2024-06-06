# Contributing to Rin

We'd love to accept your patches and contributions to this project. There are just a few small guidelines you need to follow.

# Commit-msg Hook
We have a sample commit-msg hook in scripts/commit-msg.sh. To set it up, run:

```sh
ln -s ../../scripts/commit-msg.sh commit-msg
```

This will run following checks on staged files before each commit:

1. `tsc` to check TypeScript files
2. check if commit message is starting with one of the following: feat|chore|fix|docs|ci|style|test|pref

If you want to skip the hook, run `git commit` with `--no-verify` option.

# Setup Development Environment

1. Fork & Clone the repository
2. Install [Node](https://nodejs.org/en/download/package-manager) & [Bun](https://bun.sh/)
3. Install dependencies
```sh
bun i
```
4. Copy the `wrangler.example.toml` file to `wrangler.toml` and fill in the necessary information
5. Copy the `client/.env.example` file to `client/.env` and fill in the necessary information
5. Start the development server
```sh
bun dev
```
6. For more control over the development server, you can run the dev command in the client directory and the server directory separately:
```sh
# tty1
cd client
bun dev

# tty2
cd server
bun dev
```

# Submitting changes 

1. Get at least one +1 on your PR before you push.
For simple patches, it will only take a minute for someone to review it.

2. Don't force push small changes after making the PR ready for review. Doing so will force readers to re-read your entire PR, which will delay the review process.

3. Always keep the CI green.

4. Do not push, if the CI failed on your PR. Even if you think it's not your patch's fault. Help to fix the root cause if something else has broken the CI, before pushing.

*Happy Hacking!*

# Code reviews
All submissions, including submissions by project members, require review. We use GitHub pull requests for this purpose. Consult GitHub Help for more information on using pull requests.
