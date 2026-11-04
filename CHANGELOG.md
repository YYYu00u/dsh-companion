# Changelog

All notable changes to the open-source release. The private deployment's day-by-day log is not published; this file starts at extraction.

## 0.1.1 — 2026-11-04

### Added

- Web room language switch: 中文 / English in the header, remembered in `localStorage`, `?lang=en` / `?lang=zh` for direct links.
- `public/i18n.js`: all UI chrome strings, East Asian date formatting, server-error mapping, English activity-level labels.
- English screenshots (`home-en.jpg`, `book-en.jpg`, `mobile-en.jpg`, `mobile-book-en.jpg`) and README language notes.
- 7 i18n tests: zh/en key parity, every `data-i18n` and static `t()` key, interpolation, detection, error mapping.

### Changed

- `app.js` is now an ES module and imports `i18n.js`; the page uses `<script type="module">`.
- Language switching re-renders history, the notebook, the level slider, and the tank without duplicating rows.
- The READMEs now link to each other at the top; `npm run check` enforces the link.
- Package and root versions bumped to `0.1.1`.

### Notes

- Only the chrome is translated. Her own messages, diary, memories, and generated reasons stay in the language she wrote them; a Chinese persona still speaks Chinese in the English UI.
- English labels are longer; the mobile header and drawer tabs were re-checked at 390 px with no horizontal overflow.

## 0.1.0 — 2026-11-04

First public release. Three packages extracted from a working DSH 0.2.1-rc.5 setup, then hardened for open source.

### Added

- `@dsh-companion/core`: chat-only preset with persona, notebook, mood, reminders, diary/reflection, lessons, self/standard/proposals, owner model, wants/experiences, stickers, surf/social, image search, body/skills/wishes, optional hands, and episodic memory.
- `@dsh-companion/web`: local web room (`/companion/`), SSE, history, mind API, activity level, stickers, image upload, daily life, optional exam, optional multi-persona.
- `@dsh-companion/web-search-bing`: keyless Bing search provider.
- `ensureHome()`: idempotent first-run seeding from `templates/`; `scripts/init-home.mjs` wrapper.
- `config.js`: `~`/relative path expansion, `~/.dsh-companion` default, shared name/timezone config.
- Demo server with original mock data, desktop/mobile screenshots, and a CDP screenshot script.
- 24 unit/smoke tests, `npm run check`, CI workflow.
- Five reviews (architecture, UI, interaction, function, product) with findings and dispositions.
- Install, configuration, privacy, verification, and design docs.

### Changed

- Package scopes renamed from the private `@local/*` to `@dsh-companion/*`.
- Web imports use `@dsh-companion/core/*` package exports instead of `../` paths.
- Default character renamed to 小鲤; the private persona, diary, and memories are not included.
- Home defaults to `~/.dsh-companion`; all `/Users/...` paths removed.
- Preset YAML reduced to the reference companion + hands; extra characters moved to `config.people`.
- Timezone, pet, exam, and schedule are configurable; exam is opt-in.
- Host package lookup uses `DSH_HOST_MODULES`, `argv[2]`, and `resourcesPath`.

### Fixed

- Cross-site POSTs to the web API are rejected; CSP and security headers added.
- Image picker is keyboard-accessible; closed drawer is `inert`; tabs follow the ARIA pattern; focus returns after closing.
- Error region is announced; images open full size; mobile composer no longer clips its placeholder.
- Failed proactive turns roll back counters and re-arm reminders.
- Unknown `[表情:name]` stickers are dropped instead of rendered raw.
- Missing `persona.md` no longer crashes the preset; a fresh home is seeded.
- `dsh-pet` is optional; no broadcast attempts without `pet`.

### Known limitations

- Compaction after a fresh install, multi-persona `people`, the exam, hands, and the sticker feedback loop are **beta**; see [docs/verification.md](docs/verification.md).
- DSH host internals are imported by the compaction plugin; a DSH upgrade may require a code change.
- The web API has no authentication (loopback only).
- The desktop window plugin, QQ bridge, voice, Live2D, and vector memory are not in this release.

### Not included

- The private persona, diary, notebook, memories, stickers, and screenshots of the real deployment.
- LCCC corpus data.
- The Chrome wrapper and its `node_modules`.

## Unreleased

- Persona onboarding interview (she asks, writes `persona.md`, owner approves).
- `schemaVersion` for the home.
- History pagination and a retry affordance.
- Screen-reader/axe pass.
- Verify the window plugin and decide whether it ships.
