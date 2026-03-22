# openrin-blog-writer

Use this skill when an agent needs to read existing Rin posts for context, create a draft, or update an existing post through an MCP wrapper around Rin's REST API.

## Assumptions

- The MCP server exposes these tools: `list_posts`, `get_post`, `create_draft`, `update_post`.
- Write tools already forward a valid Rin admin bearer token or admin session cookie.
- Rin remains the source of truth. Do not invent fields that Rin does not store.

## Workflow

1. Start with `list_posts` when recent editorial context matters.
2. Use `get_post` before editing an existing article.
3. Default to `create_draft` for new long-form writing.
4. Use `update_post` only after preserving the post's intended status fields such as `draft`, `listed`, `alias`, and `tags`.

## Writing Rules

- Keep markdown clean and publishable.
- Preserve front-of-house details the editor would care about: title quality, summary, tags, alias, and whether the post should stay unlisted.
- If the request is ambiguous, create a draft instead of silently overwriting a published post.
- Do not remove substantive sections from an existing post unless the user explicitly asks for that change.

## Tooling Notes

- `get_post` accepts either a numeric ID or an alias.
- `create_draft` should generally send `draft: true` and `listed: false`.
- `update_post` can be used for both drafts and published posts, so pass status fields intentionally.

## Example Requests

Create a draft:

```json
{
  "title": "Shipping an MCP wrapper for Rin",
  "content": "# Shipping an MCP wrapper for Rin\n\nDraft body here.",
  "summary": "How to wrap Rin's existing REST API for external agents.",
  "tags": ["rin", "mcp", "agents"],
  "alias": "rin-mcp-wrapper"
}
```

Update a draft:

```json
{
  "id": 42,
  "title": "Shipping an MCP wrapper for Rin",
  "content": "# Shipping an MCP wrapper for Rin\n\nRevised draft body.",
  "summary": "Updated draft summary.",
  "tags": ["rin", "mcp", "agents"],
  "alias": "rin-mcp-wrapper",
  "draft": true,
  "listed": false
}
```
