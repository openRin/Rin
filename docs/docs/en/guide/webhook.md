# Webhook Guide

Rin can send notifications to a custom webhook when:

- a new comment is created
- a new friend-link application is submitted

You can use this to connect Rin to Discord, Telegram bots, Slack gateways, Feishu, DingTalk, n8n, Zapier, or any custom HTTP endpoint.

## Where to Configure It

After deployment, open the admin **Settings** page and find the **Webhook** section.

You can also provide an initial default through the `WEBHOOK_URL` environment variable, but the settings page is the recommended place to manage webhook behavior.

## Supported Fields

Rin currently supports these webhook settings:

- `Webhook URL`: target endpoint. Template variables are supported here too, which is especially useful for GET query strings.
- `Webhook Method`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, or `OPTIONS`
- `Webhook Content-Type`: for example `application/json` or `text/plain`
- `Webhook Headers`: JSON template for custom request headers
- `Webhook Body Template`: request body template for non-GET requests
- `Send Test Webhook`: sends a test request using the current page values, including unsaved edits

## Template Variables

You can use these variables in the webhook URL, headers, and body template:

- `{{event}}`
- `{{message}}`
- `{{title}}`
- `{{url}}`
- `{{username}}`
- `{{content}}`
- `{{description}}`

## Default Behavior

If you only set `Webhook URL`, Rin uses:

- method: `POST`
- content type: `application/json`
- headers: `{}`
- body:

```json
{"content":"{{message}}"}
```

## GET Example

If your webhook provider expects query parameters, you can put variables directly in the URL:

```text
https://example.com/webhook?event={{event}}&message={{message}}&title={{title}}
```

Recommended settings:

- Method: `GET`
- Body template: leave default or ignore it

Rin will URL-encode query parameter values for GET-style URLs.

## JSON POST Example

Use these settings when your endpoint accepts JSON:

**Webhook URL**

```text
https://example.com/webhook
```

**Webhook Headers**

```json
{
  "X-Rin-Event": "{{event}}"
}
```

**Webhook Body Template**

```json
{
  "event": "{{event}}",
  "message": "{{message}}",
  "title": "{{title}}",
  "url": "{{url}}",
  "username": "{{username}}",
  "content": "{{content}}",
  "description": "{{description}}"
}
```

## Notes

- `GET` and `HEAD` requests do not send a request body.
- Template variables in webhook URLs are URL-encoded before substitution.
- `Webhook Headers` must be valid JSON after template rendering.
- If `Webhook Headers` or `Webhook Body Template` is valid JSON, Rin escapes inserted values as JSON strings to avoid breaking the JSON structure.
- If the body template is not valid JSON, Rin keeps plain-text substitution behavior unchanged.
- The test button is the fastest way to verify your endpoint before saving.

## Troubleshooting

### Test webhook failed with JSON error

Your `Webhook Headers` value is not valid JSON after template rendering. Check commas, quotes, and braces.

### The request was sent but my service rejected it

Check:

- HTTP method
- `Content-Type`
- authentication headers
- expected JSON field names
- whether your endpoint accepts GET query parameters or only POST bodies

### I only want a simple message

Keep the defaults and set only `Webhook URL`. Rin will send:

```json
{"content":"<message>"}
```
