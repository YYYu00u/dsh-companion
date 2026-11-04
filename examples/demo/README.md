# Demo server

The demo runs the **real** web bundle (`packages/web/public`) against an in-memory mock backend. It does not need DSH, a model provider, or a home directory.

```bash
npm run demo
# http://127.0.0.1:4319/companion/
```

What it exercises:

- `/api/who`, `/api/history`, `/api/mind`, `/api/level`, `/api/stickers`, `/api/sticker/<name>`, `/api/events` (SSE), `/api/send`.
- The same HTML/CSS/JS as production, including the drawer, tabs, stickers, image button, mood tank, and mobile layout.
- A few canned replies, so sending a message shows the split/rhythm path without a model.

What it does not do:

- No model calls, no session creation, no file writes.
- No compaction, life tick, reflection, hands, or senses.
- It is not a substitute for the install checklist in [docs/install.md](../../docs/install.md); it exists so contributors and reviewers can see the UI and iterate without a DSH setup.

## Screenshots

The repository's images are generated from this server:

```bash
node scripts/screenshot.mjs --url http://127.0.0.1:4319/companion/ --out docs/images/home.jpg --width 1600 --height 900
node scripts/screenshot.mjs --url http://127.0.0.1:4319/companion/ --out docs/images/book.jpg --width 1600 --height 900 --click .js-open-book
node scripts/screenshot.mjs --url http://127.0.0.1:4319/companion/ --out docs/images/mobile.jpg --width 390 --height 844 --mobile
node scripts/screenshot.mjs --url http://127.0.0.1:4319/companion/ --out docs/images/mobile-book.jpg --width 390 --height 844 --mobile --click .js-open-book
```

`scripts/screenshot.mjs` talks to Chrome over CDP; it needs Chrome installed and accepts `--chrome <path>`.

## Data

`data.mjs` is original demo content. It is intentionally non-explicit and contains no real conversations. If you add a demo line, keep it that way.
