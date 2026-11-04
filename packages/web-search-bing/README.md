# @dsh-companion/web-search-bing

A keyless Bing (`cn.bing.com`) search provider for DSH's `web_search`.

It registers a `bing` provider into `ctx.web`. The package patch overrides DSH's `web` row:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: bing
    fetchProvider: http
```

The override replaces the whole config, so `fetchProvider` must be repeated. Keep this row after any other `web` override.

## Behavior

- Requests the HTML result page and parses `<li class="b_algo">` blocks.
- Unwraps Bing's `/ck/a?...&u=a1<base64url>` redirects.
- Returns `{ sources, truncated: false }`; if the page layout changes and nothing parses, it throws `WEB_PROVIDER_ERROR` instead of inventing results.
- No API key, no login, 15 s timeout.

## Test

```bash
npm test -- packages/web-search-bing
```

The parser test uses a small fixture, not the live page.
