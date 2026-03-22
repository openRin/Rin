# MCP Integration

Rin already exposes REST-style JSON endpoints for the web app and admin writing flow. If you want external agents to read posts, draft content, or publish updates, the practical approach is to wrap the existing HTTP API with a small MCP server and pair it with a Skill prompt.

This means:

- Rin remains the content system of record
- your MCP layer translates agent tool calls into Rin HTTP requests
- you do not need to add a second content backend just for agent workflows

## What Already Exists

The current admin UI already uses backend endpoints such as:

- `GET /api/feed`: list published posts by default
- `GET /api/feed/:id`: read a single post by numeric ID or alias
- `POST /api/feed`: create a new post or draft
- `POST /api/feed/:id`: update an existing post

Published-read access is available from the public API. Draft creation and post updates require an authenticated admin session.

## Admin Setup

If you want an external agent to write through Rin:

1. Enable a normal admin login path for the instance.
2. Authenticate once with `POST /api/auth/login` or your existing GitHub-based admin flow.
3. Pass the returned bearer token, or the `token` cookie, through your MCP wrapper when calling admin-only endpoints.
4. Limit the wrapper to the minimum tools you actually want agents to use.

Rin does not currently ship a dedicated long-lived API key for content writing. The MCP wrapper should therefore operate on behalf of an authenticated admin account.

## Suggested MCP Tool Surface

Keep the first version narrow:

- `list_posts`: call `GET /api/feed?page=1&limit=20`
- `get_post`: call `GET /api/feed/:id`
- `create_draft`: call `POST /api/feed` with `draft: true`
- `update_post`: call `POST /api/feed/:id`

This is enough for most editorial agent flows:

- fetch recent posts for context
- inspect one post in full
- draft a new article
- revise an existing draft or published post

## Example Files

This repository includes minimal wrapper examples in [`examples/mcp/openrin-blog.mcp.json`](../../../examples/mcp/openrin-blog.mcp.json) and [`examples/mcp/openrin-blog-writer.SKILL.md`](../../../examples/mcp/openrin-blog-writer.SKILL.md).

They are intentionally small:

- the JSON file describes a thin MCP-style tool mapping over Rin's existing HTTP API
- the Skill file shows how another agent can use those tools safely for reading and writing blog content

These files are examples, not a bundled production MCP server.

## Operational Notes

- Treat `create_draft` as the default write path. Publish only after review.
- Preserve Rin fields such as `title`, `content`, `summary`, `tags`, `alias`, `draft`, and `listed`.
- Use aliases carefully because `GET /api/feed/:id` accepts either numeric IDs or aliases.
- If your wrapper is exposed to multiple agents, add your own audit logging and permission controls at the MCP layer.
