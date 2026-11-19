<p align="right"><strong>English</strong> | <a href="README.zh-CN.md">简体中文</a></p>

<h1 align="center">dsh-companion</h1>

<p align="center"><strong>A companion who lives on your machine: she remembers your life, and has a life of her own.</strong></p>

<p align="center">Runs inside <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>. Persona, diary and memories are plain files in a directory you own.</p>

<p align="center">
  <a href="https://github.com/YYYu00u/dsh-companion/actions/workflows/ci.yml"><img src="https://github.com/YYYu00u/dsh-companion/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-beta-f0a020" alt="Beta">
</p>

![The chat window](docs/images/window.jpg)

<sub>The chat window, reference build, demo data. Chat on the left, her mood and recent moments on the right.</sub>

## One sentence

**She is not a chat character who remembers the last twenty lines. She is a whole person you can re-skin, with layered personality and a memory that survives compression.**

- **The look is yours.** Avatar, portraits, expressions and desktop backdrop are ordinary image files; keep the names and replace the art.
- **Personality is not one prompt.** Root identity, the current her, who she wants to become, what she knows about you, and concrete notes: five layers that can change without becoming someone else.
- **Memory survives compression.** Raw turns are archived, compressed into episodes, and recalled by relevance; restart, switch models, come back a month later, she can pick up.
- **She is full.** Mood, her own days, diary, wants and refusals; not a support agent waiting for instructions.

## One evening, concretely

> **Mon 21:40** You: "Interview next Wednesday. A bit nervous."
>
> She writes it down and asks which company.
>
> **Wed 19:12** Her: "How did the interview go?"
>
> You: "Fine, nothing hard."
>
> She files it as past and stops asking.
>
> **A month later** You: "Interviews are annoying."
>
> Her: "You said that last time too, and it went better than you expected."

That exchange is possible because of three things: raw turns on disk, compression into episodes, recall by relevance. Not because the context window is big.

## Her screens

The same window, three views of the same person:

| Profile | Recent | Diary |
|---|---|---|
| ![Profile](docs/images/profile.jpg) | ![Recent](docs/images/profile-recent.jpg) | ![Diary](docs/images/profile-diary.jpg) |
| Shared facts, voice, persona slot | What she has been doing, with the feeling behind it | Her own diary, in her own words |

<sub>Reference build, demo data. The public packages carry the same file contracts; the profile tabs are the reference UI.</sub>

## What it looks like

It is not just a chat box. All three are her own screens (demo data):

![The notebook](docs/images/notebook.jpg)

<sub><b>Her notebook</b>: what she senses (what you are running), what she is holding on to, what she wants to do and has done, and the episodes she keeps. Moments, diary and what she knows about you live here too.</sub>

![Her voice](docs/images/voices.jpg)

<sub><b>Her voice</b>: ten voices, preview and switch with one click; synthesised locally, works offline.</sub>

- **Moments**: one-liners she posts on her own, mixed with the diary by time.
- **Voice**: a play button after her line, never autoplayed. She can also mark a line with `[语音]` to have it spoken.
- **Profile card**: her current mood, what she is doing, what she has learned.

## What it solves

| Common approach | The problem | What happens here |
|---|---|---|
| Cloud companion apps | History on someone else's server, fixed character, fixed model | Files on your disk, your provider, your model |
| One giant persona prompt | Drifts over time, grows without limit | Five layers with different edit rights |
| General chat assistants | They write checklists, sound like support | A delivery layer built for chatting: bubbles, pacing, the occasional typo |

**What it is not**: a work assistant. No shell, no file editing, no approval prompts. When she needs to act, a separate "hands" session does it.

## What is inside

| Install | What it is | Required |
|---|---|---|
| [`@dsh-companion/core`](packages/core) | Persona, notebook, mood, episodic memory, stickers | Yes |
| [`@dsh-companion/web`](packages/web) | API (HTTP + SSE), diary; the chat page ships here but is **not recommended** | Yes, as the backend |
| [`@dsh-companion/window`](packages/window) | QQ-like standalone window — **the daily driver** | Recommended |
| [`@dsh-companion/voice`](packages/voice) | Local voice, played on click, works offline | Extension |
| [`@dsh-companion/ears`](packages/ears) | Press, record 15 s, hand her the text | Extension |
| [`@dsh-companion/web-search-bing`](packages/web-search-bing) | Keyless Bing search | Extension |

Every extension is optional; with any of them missing, basic chat must keep working. Sizes: [docs/extensions.md](docs/extensions.md).

## What tools she has

Not a pile of APIs — a few dozen small actions she decides to use:

| For | Tools |
|---|---|
| Notes and recall | `take_note` `recall` `its_past` |
| Mood, diary, moments | `feel` `write_diary` `post_moment` |
| Growing | `grow` `learn` `judge_lesson` `update_standard` `propose_change` |
| Knowing you | `know_him` `keep_in_mind` |
| Wants and deeds | `want_to` `did` `let_go` |
| Stickers | `find_sticker` `keep_sticker` `find_pic` |
| Acting | `use_hands` (a child session that drives a browser) |

Tools have **usage frequency**: the ones she uses stay on hand, the rest sit in a drawer she pulls from — the prompt does not carry fifty schemas.

## How it runs

```mermaid
flowchart TB
  U[You] -->|window / DSH session| W[web: API + SSE<br/>delivery, daily life, diary]
  W -->|writes the session| S[DSH session<br/>preset=companion]
  S -->|system prompt| P[persona + notebook + current self]
  S -->|recall each turn| M[(episodes / raw turns)]
  S -->|at compression| M
  M -->|2-3 relevant ones| S
  W -->|bubbles / voice| U
  V[voice extension] -.->|on click| W
  E[ears extension] -.->|speech to text| S
```

- Chat goes through a DSH session; persona and memory are files, not a database.
- At compression, raw turns become episodes; the next turn recalls a few by relevance and a forgetting curve.
- Voice, ears and browser access are side extensions, off the main path.

Details: [architecture](docs/architecture.md) · [memory](docs/design/memory.md) · [delivery](docs/design/delivery.md).

## Make her yours

Nothing about her appearance or personality is hard-coded in a prompt string.

### Face and body

The window and web room read the same art from `packages/web/public/`:

```text
art-avatar.jpg          square avatar
art-face-calm.jpg       chat avatar, by mood
art-face-happy.jpg
art-face-sad.jpg
art-face-sulk.jpg
art-face-surprised.jpg
art-face-sleepy.jpg
art-half-calm.webp      full-body, right panel
art-half-happy.webp
...
art-bg-desk.jpg         backdrop
art-bg-tank.jpg         her tank
```

Keep the names, replace the files. `art-face-*` is the face bubble; `art-half-*` is the standing figure.

### Personality

In her home:

| File | What it is |
|---|---|
| `persona.md` | root identity and boundaries; owner approval |
| `self.md` | the current her — habits, opinions, feelings |
| `standard.md` | who she wants to become |
| `owner.md` | what she knows about you |
| `notebook.md` | concrete things, promises, preferences |

Edit `persona.md` for a different character; edit `self.md` for a different phase of the same character.

### Voice

`@dsh-companion/voice` ships ten voices and a local ZipVoice pipeline. Pick one, or add a reference clip; see [packages/voice](packages/voice).

### More than one

`@dsh-companion/web` accepts `people` or a `roster` file: one `/p/<id>/` per slot, each with its own chat, memory and signature. `sharedProfile` holds the facts they share. See [docs/personas.md](docs/personas.md).

## Five minutes to run

Requirements: DSH desktop 0.2.1-rc.5+, Node.js 20+, a model provider configured in DSH.

Just want to see the UI, without installing DSH:

```bash
npm run demo
# http://127.0.0.1:4399/companion/
```

That is mock data, not her brain; the DSH install is the real thing.

```bash
git clone https://github.com/YYYu00u/dsh-companion.git
cd dsh-companion
node scripts/init-home.mjs --name 大肥鱼
```

Then, in DSH → Plugins, install from a local path: `packages/core`, `packages/web`, `packages/window`. Restart DSH.

Next:

- **Daily entry**: right-click the desktop pet → "Chat with her"; without the pet, open `http://<DSH port>/companion-window/`
- **Before the first chat**: edit "你们的开始" at the end of `persona.md`, and "主人给我的设定" in `notebook.md`
- **Prefer DSH itself**: create a session with the 大肥鱼 preset

Troubleshooting: [docs/install.md](docs/install.md).

## How to use

### Open her window

Right-click the desktop pet → **和她聊天**:

![The pet menu](docs/images/pet-menu.jpg)

<sub>Menu illustration, redrawn from the real menu. The item is registered by `@dsh-companion/window`; if it is missing, the window plugin is not loaded.</sub>

No pet? Open:

```text
http://<DSH port>/companion-window/
```

The window is a standalone Electron app, not a browser tab. It uses the same transcript as the web room.

### In the window

- **Chat**: type on the left, `Enter` sends, `Shift+Enter` adds a line.
- **Her side**: the right panel shows her mood, what she is doing, and recent moments.
- **Her card**: click her avatar to open it.
- **Images**: click any image to view it full-screen.
- **Voice**: a play button appears after a spoken line; it never autoplays.
- **No pet / no window**: open `/companion-window/` directly, or use the DSH preset in a normal session.

## Day to day

- **To be remembered**: say it. She does not read minds; be specific about what matters.
- **To be forgotten**: say "that's closed", or delete `.data/memory/`.
- **To see what she remembers**: click the avatar in the window — recent, moments, diary, what she is thinking.
- **To change her voice**: pick a voice in settings, or let her mark a line with `[语音]`.
- **To quiet her down**: set the life modules (`modules`) to `[]`.

## Known limits

- **The web chat page is not recommended**: `@dsh-companion/web`'s page still has layout problems (the composer is squeezed on narrow screens). It is an API layer now.
- **Voice is beta**: 15–60 s per sentence on CPU.
- **Ears is verified on macOS only**; song ID and the web voice UI are not done.
- **Only verified on macOS.**
- **The persona here is an example**: the real diary, memories and stickers are not uploaded.

## Docs

[Install](docs/install.md) · [Extensions](docs/extensions.md) · [Verification](docs/verification.md) · [Changelog](CHANGELOG.md)

Design: [memory](docs/design/memory.md) · [delivery](docs/design/delivery.md) · [proactive life](docs/design/proactive.md) · [persona](docs/design/persona.md)

## Privacy and license

The only outbound traffic is model requests and the sites she visits; no telemetry. See [SECURITY.md](SECURITY.md). Code is MIT; third-party notices in [NOTICE](NOTICE).
