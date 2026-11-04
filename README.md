<p align="right"><a href="README.zh-CN.md">简体中文</a> | <strong>English</strong></p>

# dsh-companion

A local-first companion for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). She has a persona, a notebook, moods, episodic memory, stickers, a web room, and a life of her own — and she runs entirely on your machine, against the model provider you already use.

She is not a general assistant with a character prompt. She is a separate preset with no work tools: she only talks, remembers, and lives. The work stays in your normal DSH sessions.

![The web room](docs/images/home.jpg)

<sub>Chinese UI, demo data. The right side is her tank: the water colour follows her mood. The notebook tabs are "Today / Moments / You / Learning".</sub>

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

| Package | Role | Verified |
|---|---|---|
| [`@dsh-companion/core`](packages/core) | Chat-only preset: persona, notebook, mood, memory, stickers, body, hands | Yes — daily use before extraction; unit + fake-context smoke tests |
| [`@dsh-companion/web`](packages/web) | Web room, SSE, history, daily life, diary UI | Yes — daily use; demo server + unit tests |
| [`@dsh-companion/web-search-bing`](packages/web-search-bing) | Keyless Bing search provider | Yes — parser tests, used in production |
| Window / QQ / voice / TTS | Not in this release | No |

We deliberately do **not** ship the desktop chat-window plugin, the old in-DSH chat tab, or the Chrome wrapper in this repository. They were either unverified or mostly configuration around someone else's MCP server. See [ROADMAP.md](ROADMAP.md).

## Quick start

Requirements: DeepSeek Harness desktop **0.2.1-rc.5** or a compatible build, Node.js 20+, and a model provider configured in DSH.

```bash
git clone https://github.com/YYYu00u/dsh-companion.git
cd dsh-companion
node scripts/init-home.mjs --name 小鲤
```

This creates `~/.dsh-companion/` with a persona, notebook, standard, self-model, empty state files, and body parts. Edit `persona.md` and the "主人给我的设定" section of `notebook.md` before the first chat.

Then install the packages as DSH bundles:

1. Open **Plugins** in the DSH sidebar.
2. Install from a local path: `packages/core` first, then `packages/web` (and optionally `packages/web-search-bing`).
3. Restart DSH.
4. Create a session and choose the **小鲤** preset. For the web room, open <http://127.0.0.1:4318/companion/>.

The exact labels differ slightly between DSH builds; [docs/install.md](docs/install.md) has the manual profile fallback and troubleshooting.

### Minimal configuration

```yaml
# packages/core/cordis.patch.yml (already in the package)
- id: notebook
  name: '@dsh-companion/core'
  config:
    home: ~/.dsh-companion
    name: 小鲤
```

```yaml
# packages/web/cordis.patch.yml (already in the package)
- id: dsh-companion-web
  name: '@dsh-companion/web'
  config:
    base: /companion
    preset: dsh-companion
    name: 小鲤
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
| ![Desktop](docs/images/home.jpg) | ![Notebook](docs/images/book.jpg) | ![Mobile](docs/images/mobile.jpg) |

The demo also doubles as a UI review harness: it serves the real `packages/web/public` bundle and exercises every API shape.

## Design notes

- [Memory](docs/design/memory.md) — three layers, BM25 with character bigrams, a forgetting curve, why no vector DB yet.
- [Delivery](docs/design/delivery.md) — debounce, split replies, typing rhythm, interruption, the occasional typo.
- [Proactive life](docs/design/proactive.md) — budgets, randomness, quiet hours, and rolling back a failed turn.
- [Persona layers](docs/design/persona.md) — what she may edit, what needs your approval, and why it is all git-friendly files.
- [Reviews](docs/reviews/README.md) — architecture, UI, interaction, function, and product audits, including what we fixed and what we deliberately left.

## Verification

What "verified" means here:

- `npm test` — 26 unit/smoke tests over config bootstrap, notebook edits, levels, memory retrieval, delivery, life rollback, Bing parsing.
- `npm run check` — syntax, package manifests, private paths, secrets, stale scopes.
- `npm run demo` — the real web bundle against a mock backend, desktop + mobile.
- The core/web/search packages are extracted from a setup that ran daily against DSH 0.2.1-rc.5.
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
