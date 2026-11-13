# @dsh-companion/web

The room: a loopback-only HTTP server that mounts the chat UI, an SSE stream, the notebook/mood APIs, stickers, and the daily-life scheduler.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/who` | Name, main flag, enabled modules |
| GET | `/api/history` | Reconstructed rows (split replies, hidden unsent parts) |
| GET | `/api/events` | SSE: `row`, `typing`, `idle`, `mind` |
| POST | `/api/send` | `{text, image?, sticker?}` |
| GET | `/api/mind` | Mood, diary, moments, lessons, exams, proposals, wants, experiences, senses, owner, body, skills, wishes, life |
| GET/POST | `/api/level` | Activity level 0–4 |
| POST | `/api/reflect` | Trigger the evening reflection (403/409 guards) |
| GET | `/api/stickers` | Sticker names |
| GET | `/api/sticker/<name>` | Sticker image |
| GET | `/api/pic/<id>` | Uploaded image |

The page is served at `/companion/` (configurable `base`). A fixed loopback port (default 4318) is optional.

## Config

See [../../docs/configuration.md](../../docs/configuration.md). The important keys are `home`, `preset`, `name`, `base`, `port`, `modules`, `schedule`, `exam`, `people`, and `pet`.

## Dependencies

`@dsh-companion/core` via `file:../core`. Install core first; the web package imports `@dsh-companion/core/mind`, `/level`, `/body`, `/stickers`, `/config`.

## UI

`public/` is framework-free: `index.html`, `style.css`, `app.js`, and demo art. `npm run demo` serves the same files with mock data; no DSH or model required. Screenshots in [../../docs/images](../../docs/images).

## Security

Loopback only; cross-site state changes rejected; CSP/nosniff/no-referrer/DENY on static responses; 4 MB image cap; 4000-character text cap. No authentication by design.


## Persona slots

`config.people` or `config.roster` adds `/p/<id>/` slots, each with its own home, chat, memory and signature. `config.sharedProfile` is a JSON file used as the shared base for birthday, age, city and height. See [docs/personas.md](../../docs/personas.md).
