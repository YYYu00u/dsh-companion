# Verification

"Verified" is a claim about specific behavior, not a vibe. This page records what was actually run, what was only inspected, and what is still beta.

## Automated

```bash
npm test          # 48 tests
npm run check     # syntax + package hygiene + secret/path scan
npm run demo      # real UI, mock backend, no model calls
```

| Area | Tests | What they prove |
|---|---|---|
| First-run home | `config.test.js` | `~` expansion, default home, idempotent seeding, no overwrite |
| Notebook | `notebook.test.js` | past-section hiding, oldest-first trimming, owner-setup preservation, single-match editing, correction history |
| Activity levels | `level.test.js` | default, persistence, rejection of out-of-range values |
| Memory | `memory.test.js` | Chinese bigrams, 04:00 day boundary, bout splitting, BM25 ranking, recall strengthening |
| Core boot | `core/test/apply.test.js` | the real `apply()` runs against a fake ctx and registers the expected tools/persona |
| Web boot | `web/test/apply.test.js` | the web `apply()` boots with no DSH session |
| Window boot | `window/test/apply.test.js` | the window `apply()` boots with no DSH window |
| Ears WAV/STT | `ears/test/*.test.js` | WAV parsing, whisper CLI args, capture bounds, clean transcript, plugin boot |
| Delivery | `delivery.test.js` | splitting, sticker handling, gap bounds, typo generation, ordered send |
| Proactive | `life.test.js` | own-time prompt variety, failed-turn rollback |
| Bing | `parse.test.js` | result extraction, URL unwrapping, dedupe, empty page |
| UI language | `i18n.test.js` | zh/en key parity, every `data-i18n` and static `t()` key exists, interpolation, detection, server-error mapping |

`npm run check` also fails on personal absolute paths, the old private scope, `sk-...` keys, private keys, and stale project names.

## UI

- Desktop and mobile screenshots are produced from the demo server with `scripts/screenshot.mjs` (Chrome DevTools Protocol).
- Checked at 390×844 (mobile): no horizontal overflow (`scrollWidth === innerWidth`), drawer opens, composer fits.
- Language switch: header toggle, remembered in `localStorage`, `?lang=en` / `?lang=zh` override; English layout checked at 1600×900 and 390×844.
- Keyboard: image picker is a real button; tabs support arrows/Home/End; drawer traps Tab on narrow screens and returns focus on close; Esc closes.
- Accessibility: closed drawer is `inert`; error region is `role=alert`; images can be opened in a new tab; reduced-motion media query covers breathing, bubbles, tank transition, drawer.
- Lighthouse desktop snapshot: **Accessibility 100, Best Practices 100** for the web room (Chinese and English) and for the window demo page. SEO/agentic-browsing fail only because the demo does not serve `robots.txt` / `llms.txt`; a loopback app is not a crawlable site.
- Not done: a screen-reader pass on NVDA/VoiceOver, 200% zoom audit, high-contrast mode.

## What was used in production before extraction

The core/web/search packages are not a rewrite. They were extracted from a DSH 0.2.1-rc.5 profile that had been used daily:

- The persona/notebook/mood/memory/sticker pipeline ran with real conversations.
- The web room was the primary interface; messages, SSE, history, notebook tabs, mood tank, and the activity slider were exercised.
- Bing search was the provider for `web_search`.
- Compaction ran against real sessions and produced episodes (including a known failure mode where the extraction model returned truncated JSON; the rough fallback kept compaction alive).

That history is why the packages are called verified. It is not a claim that every option in this repository has been exercised on a clean install.

## Beta / not verified end-to-end here

| Item | Why | Manual check |
|---|---|---|
| Compaction after a fresh install | It imports DSH host packages; extraction changed paths | Install, chat past 24k tokens, confirm `episodes.jsonl` gains a non-rough episode and the next prompt contains the checkpoint text |
| `people` multi-companion | New config surface; no second character was tested in the extracted copy | Add one person, open `/p/<id>/`, send one message, confirm separate session/home |
| `exam` | Needs a judge model + LCCC corpus (not shipped) | Configure both, set level ≥2, trigger `/api/reflect`, check `exams.md` |
| Hands | Needs Chrome MCP + a child preset | Ask her to open a page; confirm `use_hands` returns a result and a skill can be saved |
| Window pet menu | Needs dsh-pet and the metadata registration | Right-click the pet; confirm "More / Chat with her" opens the Electron window and a second click focuses it |
| Ears STT | `sherpa-onnx-node` + SenseVoice int8 downloaded locally | **Verified**: 4.2 s system audio → “我是大肥鱼，这是一段测试音频。” in ~0.9 s; `listen_now` end-to-end 5.7 s incl. 4 s capture |
| Ears song ID / web voice UI | Not implemented yet | See [plans/ears.md](plans/ears.md) |
| Sticker send/judge loop | Depends on the model emitting `[表情:name]` correctly | Chat until she sends one; check `.data/stickers/sent.jsonl` and `judged` |
| Pet bubbles | Needs dsh-pet | Set `pet: main`, speak, confirm a bubble |
| macOS senses | Uses `lsappinfo` / `ioreg` | On non-macOS, confirm the plugin does not throw and senses are empty |

If any beta item fails, it should be reported as a bug, not treated as "the repo is broken". The stable path is core + web chat.

## Release checklist

- [ ] `npm test` and `npm run check` pass on Node 20 and 22 (CI).
- [ ] Demo starts on a clean checkout without `node_modules` (only the web package needs the core link; `npm run demo` serves static files and mock data).
- [ ] No `.data/`, keys, personal paths, or real persona text in the diff.
- [ ] Screenshots regenerated from demo data, not the private deployment.
- [ ] README links resolve.
- [ ] `package.json` versions bumped together; CHANGELOG entry.
- [ ] Tag `v0.2.0`.

## Reproducing the screenshots

```bash
npm run demo
node scripts/screenshot.mjs --url 'http://127.0.0.1:4319/companion/?lang=zh' --out docs/images/home.jpg --width 1600 --height 900
node scripts/screenshot.mjs --url 'http://127.0.0.1:4319/companion/?lang=zh' --out docs/images/book.jpg --width 1600 --height 900 --click .js-open-book
node scripts/screenshot.mjs --url 'http://127.0.0.1:4319/companion/?lang=zh' --out docs/images/mobile.jpg --width 390 --height 844 --mobile
node scripts/screenshot.mjs --url 'http://127.0.0.1:4319/companion/?lang=zh' --out docs/images/mobile-book.jpg --width 390 --height 844 --mobile --click .js-open-book
node scripts/screenshot.mjs --url 'http://127.0.0.1:4319/companion/?lang=en' --out docs/images/home-en.jpg --width 1600 --height 900
# ...same for book-en / mobile-en / mobile-book-en with --click .js-open-book as needed
node scripts/screenshot.mjs --url 'http://127.0.0.1:4319/companion-window/' --out docs/images/window.jpg --width 780 --height 680
```

The script needs Chrome at the default macOS path or `--chrome <path>`.
