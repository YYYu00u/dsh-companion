<p align="right"><strong>English</strong> | <a href="README.zh-CN.md">简体中文</a></p>

# dsh-companion

[![CI](https://github.com/YYYu00u/dsh-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/YYYu00u/dsh-companion/actions/workflows/ci.yml)

A local-first companion for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). She has a persona, a notebook, moods, episodic memory, stickers, a web room, and a life of her own — and she runs entirely on your machine, against the model provider you already use.

She is not a general assistant with a character prompt. She is a separate preset with no work tools: she only talks, remembers, and lives. The work stays in your normal DSH sessions.

![The web room, English UI](docs/images/home-en.jpg)

<sub>English UI, demo data. The right side is her tank: the water colour follows her mood. The notebook tabs are "Today / Moments / You / Learning".</sub>

## Why another companion project

Most "AI girlfriend" stacks are cloud products: your conversations live on someone else's server, the character is fixed, and the model is chosen for you. This project takes the opposite position:

- **Local-first.** Persona, diary, memories, stickers, and state are plain files in a directory you own. No telemetry, no account, no hosted service.
- **Bring your own model.** Any provider/model DSH can route to. The companion and the judge/exam model are configured separately.
- **Plugin-native.** It is a DSH preset + a host plugin, not a separate app that scrapes a chat UI. Sessions, tools, and context come from DSH.
- **Continuity over cleverness.** The interesting part is not the prompt; it is what survives a compaction: raw turns → episodes → recall, plus a notebook and a self-model that she edits herself.
- **Separated from work.** She gets no shell, no file editing, no approval prompts. If she needs hands, they run in a separate child session with a narrow toolset.

## What is inside

| Piece | What it does |
|---|---|
| **Persona** | `persona.md` is the root. It is re-read every turn, so editing the file changes the next sentence. |
| **Notebook** | `notebook.md`: things she noted about you and about herself. Old items can be moved to "past" instead of deleted. |
| **Mood** | A 0–100 score with a slow "base mood" layer, a half-life, and ten named feelings. Mood changes how she talks. |
| **Episodic memory** | Raw turns are archived; on compaction they become episodes with keywords, people, emotion, importance, and links. Recall is BM25 + a forgetting curve. |
| **Daily life** | Reminders, an evening diary/reflection, random "own time", and proactive messages with budgets and quiet hours. |
| **Stickers** | She can keep images, describe when to use them, send them as `[表情:name]`, and learn from your reaction. |
| **Body index** | Body parts map to real tools. If a tool is missing, she knows that part does not work instead of pretending. |
| **Hands (optional)** | A child session with browser access. She writes the task; the hands do the clicking and return a short result. |
| **Web room (optional)** | Chat, SSE, her notebook, mood tank, diary, stickers, activity level. Desktop and mobile. |

## How she remembers you

Most companions keep the last N messages in context. When the window fills, they compress it into a paragraph, and the relationship becomes "they talked about some things". This project takes the harder path.

| Layer | What it holds | When it is used |
|---|---|---|
| Short-term | The live chat | Every turn, until compaction |
| Episodic | Episodes: one bout of conversation, summarized with title, gist, keywords, people, emotion, importance, open loops, links | Written on compaction; 2–3 relevant episodes are recalled each turn |
| Long-term | Notebook, what she knows about you, her current self, her standard | In the system prompt every turn, no retrieval |

A concrete example: you say "interview next Wednesday, a bit nervous." She notes it and asks on Wednesday. You say "done, it went okay"; she moves it to "past" and stops asking. A month later you say "interviews are annoying"; she remembers "last time you were nervous too, and it went better than you expected" — not the whole transcript.

Why no vector DB yet: the corpus is small, the target environment may not have an embedding model, and BM25 over Chinese character bigrams is explainable. Revisit at ~500 episodes or when paraphrase recall starts failing. The formulas and the comparison are in [docs/design/memory.md](docs/design/memory.md).

## Her persona is not one prompt

| File | What it is | Who edits it |
|---|---|---|
| `persona.md` | The root: who she is, how she speaks, where her boundaries are | You; she can only propose |
| `self.md` | The current her: habits, opinions, feelings | Her (`grow`) |
| `standard.md` | Who she wants to become | Her (evening reflection) |
| `owner.md` | What she knows about you, by section | Her (`know_him`) |
| `notebook.md` | Concrete events, promises, preferences | Her (`take_note`) |

She can grow, but she cannot become a different person overnight. Changing the root requires a `propose_change`; the web room shows it in "She wants to change — waiting for you". Editing a file directly works too and takes effect on the next reply.

A practical workflow: write three sentences in "你们的开始" (how you met, what she calls you, where she lives on the computer); chat for a week; read what she wrote into `self.md` and `owner.md`; then adjust one line at a time. More in [docs/design/persona.md](docs/design/persona.md), and the Chinese deep-dive in [docs/zh-CN/persona.md](docs/zh-CN/persona.md).

## Architecture

```mermaid
flowchart LR
  subgraph DSH[DeepSeek Harness]
    S[Session / agent loop] -->|system prompt + tools| C
    C[core preset<br/>persona, notebook, mood, memory, stickers] -->|tool calls| F[(home directory<br/>plain files)]
    W[web host plugin<br/>HTTP + SSE + daily life] -->|prompt| S
    W -->|read/write| F
    C -->|compaction hook| M[memory compaction<br/>turns → episodes]
    M --> F
    C -->|use_hands| H[hands preset<br/>browser tools]
  end
  U[Browser] -->|/companion/| W
  P[Model provider] <--> S
```

The detailed component and data-flow docs are in [docs/architecture.md](docs/architecture.md).

## Packages

Two packages are the base — install those and you can talk to her. Everything below the divider is an **extension**: optional, downloaded separately, and never required. If an extension is missing or fails to start, the base must keep working (no voice button, no listening, chat unaffected). Sizes and dependencies: [docs/extensions.md](docs/extensions.md).

### Base

| Package | Role | Verified |
|---|---|---|
| [`@dsh-companion/core`](packages/core) | Chat-only preset: persona, notebook, mood, memory, stickers, body, hands | Yes — daily use before extraction; unit + fake-context smoke tests |
| [`@dsh-companion/web`](packages/web) | Web room, SSE, history, daily life, diary UI, 中文/English switch | Yes — daily use; demo server + unit tests |
### Extensions (optional)

| Package | Extra capability | Extra download | Verified |
|---|---|---|---|
| [`@dsh-companion/window`](packages/window) | QQ-like standalone chat window, opened from the desktop pet | none | Page + Electron verified; pet menu is beta |
| [`@dsh-companion/web-search-bing`](packages/web-search-bing) | Keyless Bing search provider | none | Yes — parser tests, used in production |
| [`@dsh-companion/ears`](packages/ears) | Push-to-talk system audio / mic / audio files → text | ASR model + macOS capture helper | **Beta** — capture + SenseVoice verified; song ID/web UI pending |
| [`@dsh-companion/voice`](packages/voice) | Local voice: ZipVoice zero-shot, click-to-play speech in the room | 197 MB model + reference clips | **Beta** — 15–60 s per sentence |
| QQ / voice calls | Not in this release | No |

The old in-DSH chat tab is deprecated and not shipped. The Chrome wrapper is [extras/chrome](extras/chrome) — a documented setup for someone else's MCP server, not a package. See [ROADMAP.md](ROADMAP.md).

## Quick start

Requirements: DeepSeek Harness desktop **0.2.1-rc.5** or a compatible build, Node.js 20+, and a model provider configured in DSH.

```bash
git clone https://github.com/YYYu00u/dsh-companion.git
cd dsh-companion
node scripts/init-home.mjs --name 大肥鱼
```

This creates `~/.dsh-companion/` with a persona, notebook, standard, self-model, empty state files, and body parts. Edit `persona.md` and the "主人给我的设定" section of `notebook.md` before the first chat.

Then install the packages as DSH bundles:

1. Open **Plugins** in the DSH sidebar.
2. Install from a local path: `packages/core` first, then `packages/web`. That is the base and it is enough to chat; add [extensions](docs/extensions.md) later if you want a window, a voice, or ears.
3. Restart DSH.
4. Create a session and choose the **大肥鱼** preset. For the web room, open <http://127.0.0.1:4318/companion/>.

The exact labels differ slightly between DSH builds; [docs/install.md](docs/install.md) has the manual profile fallback and troubleshooting.

### Minimal configuration

```yaml
# packages/core/cordis.patch.yml (already in the package)
- id: notebook
  name: '@dsh-companion/core'
  config:
    home: ~/.dsh-companion
    name: 大肥鱼
```

```yaml
# packages/web/cordis.patch.yml (already in the package)
- id: dsh-companion-web
  name: '@dsh-companion/web'
  config:
    base: /companion
    preset: dsh-companion
    name: 大肥鱼
    home: ~/.dsh-companion
    port: 4318
```

Everything else is optional: `modules` (which parts of her daily life run), `schedule` (quiet hours), `exam` (the optional Turing-style self-check), `people` (multiple companions on one install), and `pet` (dsh-pet bubbles).

## The web room

```bash
# No DSH needed: real UI, mock data, no model calls.
npm run demo            # http://127.0.0.1:4319/companion/
```

| Desktop | Notebook | Mobile |
|---|---|---|
| ![Desktop](docs/images/home-en.jpg) | ![Notebook](docs/images/book-en.jpg) | ![Mobile](docs/images/mobile-en.jpg) |

The UI switches between 中文 and English from the header. The choice is remembered, and `?lang=en` / `?lang=zh` gives you a direct link. Only the chrome is translated; her own words, diary, and memories stay in whatever language she wrote them.

The demo also doubles as a UI review harness: it serves the real `packages/web/public` bundle and exercises every API shape.

## Desktop window

![The desktop window](docs/images/window.jpg)

`@dsh-companion/window` is a QQ-like standalone window: chat on the left, her mood and recent moments on the right, a profile card when you click her. It is served at `/companion-window/` and uses the same transcript as the web room. It opens from the desktop pet's right-click menu, or directly from the URL. Images open full-screen on click; close with the backdrop, `×`, or Escape.

## Voice and listening (beta)

`@dsh-companion/voice` gives her an **offline** voice: a handful of reference voices, cloned locally with ZipVoice (no training). Replies get a `▶` button in the web room; she marks a line with `[语音]` to have it spoken, and `[文字]` to opt back out. The model is 197 MB and the reference clips are generated with your own key; on CPU a sentence takes 15–60 s at 8 steps. Numbers: [packages/voice/docs/en/voice.md](packages/voice/docs/en/voice.md).

`@dsh-companion/ears` records 15–30 seconds of system audio, the microphone, or an audio file and turns it into text. The capture helper is verified on macOS 15.1 / M2; ASR was verified locally with the SenseVoice int8 model; song ID and the web voice UI are still pending. There is no always-on listening. Plan and limits: [docs/plans/ears.md](docs/plans/ears.md).

## Design notes

- [Memory](docs/design/memory.md) — three layers, BM25 with character bigrams, a forgetting curve, why no vector DB yet.
- [Delivery](docs/design/delivery.md) — debounce, split replies, typing rhythm, interruption, the occasional typo.
- [Proactive life](docs/design/proactive.md) — budgets, randomness, quiet hours, and rolling back a failed turn.
- [Persona layers](docs/design/persona.md) — what she may edit, what needs your approval, and why it is all git-friendly files.
- [Reviews](docs/reviews/README.md) — architecture, UI, interaction, function, and product audits, including what we fixed and what we deliberately left.

## Verification

What "verified" means here:

- `npm test` — 48 unit/smoke tests over config bootstrap, notebook edits, levels, memory retrieval, delivery, life rollback, Bing parsing, UI i18n, and ears WAV/STT helpers.
- `npm run check` — syntax, package manifests, private paths, secrets, stale scopes.
- `npm run demo` — the real web bundle against a mock backend, desktop + mobile.
- The core/web/window/search packages are extracted from a setup that ran daily against DSH 0.2.1-rc.5; the window page and Electron app were exercised and screenshotted. `ears` is beta: capture and SenseVoice ASR are verified locally, but song ID and the web voice UI are still pending.
- Not verified end-to-end in this repository: the compaction plugin after a fresh install, multi-persona `people`, and the optional exam. They are marked **beta** in [docs/verification.md](docs/verification.md), with the exact manual check to run.

## Privacy and safety

- Everything is local. The only outbound traffic is what DSH already sends to your model provider and the sites she explicitly visits.
- The web server binds to `127.0.0.1` only; cross-site POSTs are rejected. It has no login. Do not expose the port.
- `.data/` is git-ignored: raw turns, mood state, API keys, uploaded images. Do not commit it.
- The example persona is intentionally non-explicit. What you write in `persona.md` is your responsibility; do not publish someone else's intimate data.
- The demo assets are AI-generated. See [NOTICE](NOTICE).

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); good first issues are labelled in the tracker. For anything that changes the persona format or the memory schema, open an issue first — those are the two things that are expensive to migrate.

## License

Code is [MIT](LICENSE). The demo art is **not** MIT; see [NOTICE](NOTICE). The LCCC corpus used by the optional exam is not redistributed; download it yourself and check its license.

## Acknowledgements

- DeepSeek Harness for the plugin/preset model and the compaction base class.
- The open companion community whose designs we compared and learned from; the comparison notes are in [docs/design/memory.md](docs/design/memory.md) and the review archive.
- LCCC (Tsinghua) for the human-dialogue corpus used by the optional exam.
