# Configuration

All configuration lives in the package's `cordis.patch.yml` and is passed to the plugin's `apply(ctx, config)`. Nothing is read from environment variables except `DSH_HOST_MODULES` (a host-package lookup hint).

## `@dsh-companion/core`

The preset row:

```yaml
- id: notebook
  name: '@dsh-companion/core'
  config:
    home: ~/.dsh-companion
    name: 大肥鱼
    handsPreset: dsh-companion-hands
```

| Key | Default | Meaning |
|---|---|---|
| `home` | `~/.dsh-companion` (or the notebook's directory) | The home. Everything she owns lives here. |
| `name` | `大肥鱼` | Display name, notebook template, git author, hands prompt. |
| `notebook` | `<home>/notebook.md` | Override the notebook path. |
| `persona` | `<home>/persona.md` | Override the persona path. |
| `hands` | `true` | Set `false` to register no `use_hands` tool. |
| `handsPreset` | `dsh-companion-hands` | The preset id used for the child session. |
| `email` | `persona@local` | Git author email for home commits. |
| `timeZone` | system timezone | IANA zone used in the prompt and `clientTimeZone`. |

The hands preset:

```yaml
- id: hands
  name: '@dsh-companion/core/hands'
  config:
    home: ~/.dsh-companion
    name: 大肥鱼
```

It shares `home` and `name`; it has no other options.

The compaction row:

```yaml
- id: compaction-companion
  name: '@dsh-companion/core/compact'
  config:
    home: ~/.dsh-companion
    preset: dsh-companion
    name: 大肥鱼
    thresholdTokens: 24000
    retainTokens: 6000
    episodeProvider: your-provider
    episodeModel: your-model
    # daily: false
    # stripReasoning: false
```

| Key | Default | Meaning |
|---|---|---|
| `home` | required | Must match the core home. |
| `preset` | required for reasoning stripping | Only sessions with this preset are touched. |
| `name` | `大肥鱼` | How the transcript is labeled when writing episodes. |
| `thresholdTokens` | `24000` | Compact when the live history exceeds this. |
| `retainTokens` | `6000` | Keep this much recent raw text after compaction. |
| `episodeProvider` / `episodeModel` | current routed model | The model that writes episodes. |
| `daily` | `true` | Also compact yesterday's turns once a day. |
| `stripReasoning` | `true` | Remove finished-turn reasoning from requests. |

Unrecognized keys are passed to DSH's `BasicCompactionEngine`, which rejects unknown keys. Do not add arbitrary fields here.

## `@dsh-companion/web`

```yaml
- id: dsh-companion-web
  name: '@dsh-companion/web'
  config:
    base: /companion
    preset: dsh-companion
    name: 大肥鱼
    home: ~/.dsh-companion
    port: 4318
    modules: [remind, reflect, own, nudge]
    schedule:
      quietStart: 23
      quietEnd: 8
      reflectAt: "22:30"
      ownChancePerTick: 0.0166667
      idleBaseMs: 10800000
      idleMaxMs: 43200000
    exam:
      enabled: false
      corpus: ~/.dsh-companion/.data/corpus/human-pairs.json
      judge:
        provider: your-provider
        model: your-judge-model
    pet: main
    people: []
```

| Key | Default | Meaning |
|---|---|---|
| `base` | `/companion` | URL prefix. Must start with `/`. |
| `preset` | `dsh-companion` | Session preset created/used by the web plugin. |
| `name` | `大肥鱼` | Name shown in the UI and `/api/who`. |
| `home` | `~/.dsh-companion` | Home. Must match core. |
| `chatCwd` | `home` | Working directory for the session. |
| `cwd` | process cwd | Base for relative paths. |
| `port` | `4318` | Fixed loopback port; `0` disables it. |
| `modules` | all four | Which daily-life modules run. `[]` = chat only. |
| `schedule.quietStart` / `quietEnd` | `23` / `8` | No proactive messages in this window. |
| `schedule.reflectAt` | `22:30` | Earliest reflection time. |
| `schedule.ownChancePerTick` | `1/60` | Per-minute chance of own time after the floors. |
| `schedule.idleBaseMs` / `idleMaxMs` | 3h / 12h | Nudge backoff bounds. |
| `exam.enabled` | `false` | Run the optional exam. |
| `exam.corpus` | none | Human dialogue JSON. |
| `exam.judge.provider` / `.model` | none | Separate judge model. |
| `pet` | unset | dsh-pet id; set `main` to enable bubbles. |
| `people` | `[]` | Additional companions, each at `/p/<id>/`. |
| `roster` | none | Alternatively, a JSON file with `{ "people": [...] }`. |

### Multiple companions

One install can host several characters. Each needs its own home and its own DSH preset (which can be a copy of the core preset with a different `id`, `name`, and `home`).

```yaml
people:
  - id: laoge
    name: 阿岚
    home: ~/.dsh-companion-people/laoge
    preset: persona-laoge
    life: []
```

- `id` must match `[a-z0-9-]+`; it becomes the URL `/p/<id>/`.
- `life: []` means chat only, no proactive modules or timers.
- The home is seeded automatically if missing.
- The main companion is always at `base` (`/companion/`).

### Disabling modules

| Module | What you lose |
|---|---|
| `remind` | She stops asking about reminders. |
| `reflect` | No evening diary/reflection/lesson judging. |
| `own` | No own-time exploration. |
| `nudge` | She never initiates after silence. |

Removing `nudge` and `own` makes her purely reactive and is a good way to reduce token spend.

## `@dsh-companion/window`

```yaml
- id: dsh-companion-window
  name: '@dsh-companion/window'
  config:
    home: ~/.dsh-companion
    name: 大肥鱼
    chatBase: /companion
    # menuOwner: 大肥鱼
    # menuLabel: 和她聊天
    # electron: /path/to/Electron
```

| Key | Default | Meaning |
|---|---|---|
| `home` | `~/.dsh-companion` | Used for the Electron profile (`<home>/.data/chat-window`), not chat data. |
| `name` | `大肥鱼` | Window title and pet-menu owner. |
| `chatBase` | `/companion` | Must match the web plugin's `base`; the window page uses it for `api/*` and images. |
| `menuOwner` | `name` | dsh-pet menu owner; change only if you know the pet API. |
| `menuLabel` | `和她聊天` | Pet menu item label. |
| `electron` | `~/.dsh/electron/...` | Electron binary; falls back to Chrome `--app` then the default browser. |

The window is optional. It has no API of its own; it reads `/companion/api/*` from the web plugin, so the two must point at the same home and base.

## `@dsh-companion/web-search-bing`

No config. It registers a `bing` provider and the package patch overrides DSH's `web` row:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: bing
    fetchProvider: http
```

The override replaces the whole `config` block, so `fetchProvider` must be repeated. If another plugin also overrides `web`, only one can win; keep this row after the other.

## Environment

| Variable | Used by | Meaning |
|---|---|---|
| `DSH_HOST_MODULES` | `core/memory/hostdeps.js` | Directory containing `@deepseek-ai/*` host packages, if auto-detection fails. |

## Files that are not configuration

- `.data/level.json` — the activity slider; change it in the UI.
- `.data/mind/life.json` — daily counters and retry timestamps.
- `.data/memory/*` — memory state.
- `lessons.json`, `reminders.json`, `wants.json` — her own state, edited by tools.

Editing those by hand is possible but can confuse counters; prefer the UI/tools.
