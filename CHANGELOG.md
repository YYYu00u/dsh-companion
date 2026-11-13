# Changelog

All notable changes to the open-source release. The private deployment's day-by-day log is not published; this file starts at extraction.

## Unreleased

### Added

- `@dsh-companion/voice` now serves its own HTTP surface at `/companion-voice/`: the picker page, the voice list, reference audio, `POST /api/say`, and `POST /api/voices/default` (persisted to `~/.dsh-companion/voice.json`). It no longer needs the web package to wire voice up.
- `steps` is configurable through the plugin config, not just the Python CLI.
- 4 route tests with a fake context (no Python, no DSH): registration, list, default persistence, page redirect.

### Notes

- The deployment's web room still uses its own `/api/say`; both paths end at the same local service.

### Added

- `extensions.json` + `npm run extensions`: a machine-readable catalog of optional extensions (package, status, what to download, sha256 of model files). `node scripts/extensions.mjs check` validates it; three tests cover the invariants.

### Changed

- [docs/extensions.md](docs/extensions.md) now points at the manifest instead of a hand-maintained table.

### Changed

- Docs: split [extensions](docs/extensions.md) out of the package table. Two base packages (core + web) are enough to chat; window, voice, ears, bing and Chrome are optional, each with its own download.
- Both READMEs now state the hard rule: an extension that is missing or fails to start must leave the base untouched.

## 0.3.14 — a screenshot she can send

### Added

- `send_screen`: captures the desktop, resizes it to 1280px, and sends it as her image message through the web room.
- `POST /api/her/send`: stores the image under `.data/stickers-in`, appends to `.data/her-shots.json`, and merges it into history.
- `chatBase` core config (default `/companion`) tells the tool where the web room is mounted.

## 0.3.13 — public access without the search gate

### Added

- `bilibili` tool: public search, video info, popular and ranking through Bilibili's public endpoints, no login and no search-page captcha.
- Hands prompt: on a captcha/slider/scan gate, stop and hand off; for Bilibili search, try public data or a `site:bilibili.com` search instead of hitting the gate.

## 0.3.12 — the desktop window

### Added

- Click any image in the web room or the QQ-like desktop window to open a full-screen lightbox; close with the backdrop, the ×, or Escape.

### Changed

- `stripMeta()` drops model planning leaked into the visible reply (`按角色：`, `回应：`, `简短一点`), keeping the final message.
- Public window docs now describe the image viewer and the window's role as the standalone desktop shell.

## 0.3.11 — 2026-11-06

### Added

- Mood-driven typo corrections: the fix-up is a normal sentence chosen by mood, and `profile.json` can set `typoChance` / `typoStyle`.
- `@dsh-companion/voice` 0.1.1: long lines are split before synthesis (the model drops tails), per-request steps, and the picker persists the chosen default.
- `[语音]` makes a whole reply spoken; `[文字]` opts a later line back out.
- Sticker dedupe by perceptual hash (64-bit dHash, Hamming ≤ 10), ffmpeg optional.

### Changed

- Voice picker page and manifest copy updated to match the persisted default.

## 0.3.10 — 2026-11-05

### Changed

- Typo corrections no longer use `*word`. The follow-up is natural and selected from her current mood: `打错了，是「就」` / `（是「就」）` / `是「就」啦` / `改：就`.
- `profile.json` can override `typoChance` (0–0.2) or pin `typoStyle`; otherwise the style follows her mood.

## 0.3.9 — 2026-11-05

### Fixed

- The typo-correction line now contains only the corrected character (`*就`) instead of also appending the next character (`*就不`).

## 0.3.8 — 2026-11-05

### Changed

- Input debounce is now 4.2–5.6 s (capped at 12 s) instead of a fixed 3 s, so a second or third message sent within the window merges into one turn.
- The first delivered reply waits an additional 0.45–1.35 s; later lines keep the existing per-character random gap.

## 0.3.7 — 2026-11-05

### Changed

- Sidebar polish: no system-blue focus ring when the window opens, a stronger top gradient so mood text does not sit on the figure's face, and a capped/scrollable latest-post block so long posts cannot displace the figure.

## 0.3.6 — 2026-11-05

### Fixed

- The window and web sidebars now keep the figure in place when the latest-post text is long: the shell clips overflow, the figure area can shrink, and the latest block scrolls within a capped height.

## 0.3.5 — 2026-11-05

### Changed

- Aligned the web and window sidebars: both are 320 px, use the same tank/figure treatment, and show the same fields: mood, what she is doing, the latest post, and a book/全部说说 entry.
- The public window now has the `doing` field and a book link; the public web room now has a compact latest-post block.

## 0.3.4 — 2026-11-05

### Added

- Web room typing bubble: when a turn starts, a `她在想…` row with three animated dots appears in the chat list and is removed when a message arrives or the turn ends.

## 0.3.3 — 2026-11-05

### Fixed

- Window history no longer animates from the top to the bottom: `.list` uses `scroll-behavior: auto`; the first page is positioned at the bottom before it becomes visible.

## 0.3.2 — 2026-11-05

### Added

- History pagination in the public web package: the API returns the recent 30 rows by default and accepts `before=<seq>`; the client loads older pages when scrolled to the top and preserves scroll position.
- [docs/integrations/ears-voice.md](docs/integrations/ears-voice.md): the cross-plugin contract for ears, voice, the `[语音 v-...]` marker, TTS cache, and history pagination.

### Notes

- The private host still owns the live voice-message and TTS-cache UI; the public package documents the contract but does not ship that host integration.

## 0.3.1 — 2026-11-05

### Fixed

- Corrected the 0.3.0 notes: the public packages ship the optional ears button and the window icon, but **not** the private deployment's hold-to-talk voice bubbles or TTS cache.
- The voice package README now says the cache lives in the host, not in `@dsh-companion/voice`.

## 0.3.0 — 2026-11-05

### Added

- `@dsh-companion/ears` (beta): push-to-talk system audio / microphone / audio files → text. Objective-C ScreenCaptureKit helper, local sherpa-onnx + SenseVoiceSmall, optional AssemblyAI; `listen_now` / `listen_file`; pet menu and `/ears/api/*` when installed as a Host bundle.
- `@dsh-companion/voice` (beta): local ZipVoice zero-shot voice, click-to-play; model and reference audio stay out of the repository.
- Window: custom fish icon and app name for the Electron chat window; history opens at the bottom.
- Web: optional listen button, hidden unless the ears endpoint exists.
- The private deployment also has hold-to-talk voice messages, WeChat-style voice bubbles, and a TTS cache; those are not part of this release yet.
- Tests: 48 total, including ears WAV/STT/pet-menu and window boot.

### Notes

- `ears` and `voice` are beta; see [docs/verification.md](docs/verification.md).
- TTS is CPU-only and not real-time (15–60 s per sentence); voice messages are transcribed in the background, not live captions.


### Voice setup

- `npm run models` downloads the int8 model and vocoder into `.models/` and verifies sha256; `npm run refs` regenerates the reference clips with the user's own key.
- Reference audio and model weights are deliberately **not** shipped (provider terms, size); the manifest keeps the exact transcript, which cloning needs.
- Docs: [packages/voice/README.md](packages/voice/README.md).

## 0.2.0 — 2026-11-04

### Added

- `@dsh-companion/window`: a QQ-like standalone chat window at `/companion-window/`, using the web room's transcript. It launches the Electron bundled with DSH, falls back to Chrome `--app`, then the default browser; the pet menu is optional.
- `extras/chrome`: a reproducible local setup for `chrome-devtools-mcp` (not our code), with an example DSH row.
- Chinese deep-dives: [docs/zh-CN/memory.md](docs/zh-CN/memory.md), [docs/zh-CN/persona.md](docs/zh-CN/persona.md), and a Chinese docs index.
- Window screenshot (`docs/images/window.jpg`), produced from demo data, not a private chat.
- Window boot smoke test (`packages/window/test/apply.test.js`).

### Changed

- The default character is now **大肥鱼** everywhere: config, templates, locales, UI, demo, docs, and screenshots. The shipped persona remains an original, non-explicit example; the private deployment's persona and memories are still not included.
- The Chinese README was rewritten as an introduction to the ideas, not a translation: memory layers, a concrete example, persona layers, practical recipes, and a plugin inventory. It now lives in `README.md` under the `#zh` anchor; `README.zh-CN.md` is a pointer for old links.
- English README updated with the window package, Chrome extra, and test counts.
- All screenshots regenerated with the new name; the English README shows the English UI, the Chinese README the Chinese UI.
- Package and root versions bumped to `0.2.0`.

### Notes

- The window UI is Chinese-first; the web room has the 中/EN switch.
- The pet menu registration is best-effort; without `dsh-pet`, open `/companion-window/` directly.
- 34 tests pass; CI runs on Node 20 and 22.

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
- Default character renamed to 大肥鱼; the private persona, diary, and memories are not included.
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

### Planned

- Ears: push-to-talk system audio, microphone, voice messages, local ASR, ShazamKit song ID. See [docs/plans/ears.md](docs/plans/ears.md).
- Third-party notices and BSD-2 license text for the AudioCap-derived capture helper.


- Persona onboarding interview (she asks, writes `persona.md`, owner approves).
- `schemaVersion` for the home.
- History pagination and a retry affordance.
- Screen-reader/axe pass.
- Verify the window plugin and decide whether it ships.
