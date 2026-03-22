---
name: rin-agent
description: Read and update Rin blog content through a user-provided API key. Use when an external agent needs to list posts, read a post, create or update drafts, publish moments, or upload media to a Rin site.
---

# Rin Agent Access

## Required Inputs

- `RIN_BASE_URL`: the public base URL of the Rin site, for example `https://blog.example.com`
- `RIN_API_KEY`: an API key created from Rin admin at `/admin/api-keys`

Send the API key as a bearer token on every request:

```http
Authorization: Bearer <RIN_API_KEY>
```

## Supported Content Workflows

### List published posts

`GET {{RIN_BASE_URL}}/api/feed`

### Read a post

`GET {{RIN_BASE_URL}}/api/feed/:id`

`id` can be the numeric id or the post alias.

### Create a post

`POST {{RIN_BASE_URL}}/api/feed`

```json
{
  "title": "Agent draft",
  "content": "# Hello from Rin",
  "summary": "Created by an external agent",
  "draft": true,
  "listed": false,
  "tags": []
}
```

### Update a post

`POST {{RIN_BASE_URL}}/api/feed/:id`

Send the same shape used for create, with the fields you want to change.

### Delete a post

`DELETE {{RIN_BASE_URL}}/api/feed/:id`

### Create a moment

`POST {{RIN_BASE_URL}}/api/moments`

```json
{
  "content": "Short update from an external agent."
}
```

### Upload media

`POST {{RIN_BASE_URL}}/api/storage`

Use `multipart/form-data` with:

- `file`: the uploaded file
- `key`: optional original filename

## Constraints

- These API keys are intended for content workflows, not site-wide settings changes.
- Treat the key as a secret. Rin only shows the full value once when the key is created.
- If a request returns `401` or `403`, ask the user to verify the key is still active in `/admin/api-keys`.
