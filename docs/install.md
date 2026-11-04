# Install

## Requirements

- **DeepSeek Harness desktop 0.2.1-rc.5** or a compatible build. The compaction plugin imports host packages; a different DSH major/minor may need a code change.
- **Node.js 20+** for the test/demo scripts. DSH ships its own Node; the plugins run inside it.
- A model provider configured in DSH (any provider/model DSH can route to).
- Optional: `dsh-pet` for desktop bubbles, Chrome + `chrome-devtools-mcp` for hands.

## 1. Get the code and make a home

```bash
git clone https://github.com/YYYu00u/dsh-companion.git
cd dsh-companion
node scripts/init-home.mjs --name 大肥鱼
```

`init-home` is just a wrapper around the same `ensureHome()` the plugin runs on first boot. It creates:

```
~/.dsh-companion/
  persona.md notebook.md standard.md self.md owner.md
  experiences.md moments.md lessons.json reminders.json wants.json slang.json
  body/... skills/ stickers/ diary/ .gitignore
```

Edit `persona.md` and `notebook.md` first. Nothing works well with the generic template.

> If you want the home somewhere else, pass `--home ~/somewhere` and set the same `home` in both package configs. `~` is expanded; relative paths resolve against the DSH process's working directory.

## 2. Install the bundles

The supported path is DSH's plugin manager:

1. Open the **Plugins** page in the DSH sidebar.
2. Choose **Install from a local path** (wording varies by build).
3. Select `packages/core` and install/enable it.
4. Select `packages/web` and install/enable it.
5. Optional: `packages/window` (standalone chat window).
6. Optional: `packages/web-search-bing`.
7. Restart DSH.

Installing `packages/web` also needs `@dsh-companion/core` to be resolvable. Installing core first is the simplest way; the web package declares `"@dsh-companion/core": "file:../core"`.

After restart, a new session should offer the preset **大肥鱼**. Open the web room at:

```
http://127.0.0.1:4318/companion/
```

(DSH's own port also serves `/companion/`; the fixed port is just a stable bookmark.) The optional window is at `/companion-window/` on the DSH port; with the pet installed, right-click it and choose **More / Chat with her**.

## 3. Manual profile fallback

Use this only if the plugin manager cannot install a local bundle. Back up the profile first. The profile is at `~/.dsh/profiles/<profile>/` (typically `desktop`).

`package.json`:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@dsh-companion/core",
        "@dsh-companion/web",
        "@dsh-companion/window"
      ]
    }
  },
  "dependencies": {
    "@dsh-companion/core": "link:/absolute/path/to/dsh-companion/packages/core",
    "@dsh-companion/web": "link:/absolute/path/to/dsh-companion/packages/web",
    "@dsh-companion/window": "link:/absolute/path/to/dsh-companion/packages/window"
  }
}
```

Then run the profile's package manager (DSH uses pnpm internally) and restart. The bundle list order matters: later bundles can override earlier rows; keep `dsh-base` and `dsh-web-app` first.

Manual edits are easy to get wrong and are not covered by the plugin manager's rollback. Prefer the UI.

## 4. Optional: desktop pet

If `dsh-pet` is installed and running, set:

```yaml
config:
  pet: main
```

in the web row. Without it, leave `pet` unset; the web plugin will not try to broadcast.

## 5. Optional: standalone window

Install `packages/window` after core and web. It serves `/companion-window/` on the DSH port and reuses the web room's transcript. With `dsh-pet`, right-click the pet → **More / Chat with her**; without it, open the URL directly.

## 6. Optional: hands (browser)

`use_hands` needs two things:

1. A Host-level Chrome MCP row (`@deepseek-ai/dsh-mcp-client` with `chrome-devtools-mcp`). This is standard DSH configuration, not part of this repo. A reproducible local setup is in [extras/chrome](../extras/chrome/).
2. The hands preset from `packages/core/cordis.patch.yml` (`dsh-companion-hands`).

Without them, `use_hands` reports that the hands are not connected and she can record a wish instead. She will not pretend to have clicked something.

## 7. Optional: exam

The evening exam compares her lines with human dialogue and asks a separate judge model which are AI. It is off by default because it needs:

- a local corpus file in `[{ "a": "...", "b": "..." }]` format (LCCC is the intended source; not redistributed);
- a judge provider/model.

```yaml
exam:
  enabled: true
  corpus: ~/.dsh-companion/.data/corpus/human-pairs.json
  judge:
    provider: your-provider
    model: your-judge-model
```

If either is missing, the reflection notes "没体检成" and continues. It never blocks the diary.

## 8. Post-install checklist

- [ ] New session shows the **大肥鱼** preset.
- [ ] Sending "你好" produces a reply; the web room shows both bubbles.
- [ ] `~/.dsh-companion/notebook.md` gains a note when you tell her a durable fact.
- [ ] `~/.dsh-companion/.data/memory/turns.jsonl` grows as you chat.
- [ ] The mood in the web room changes when you say something warm/cold.
- [ ] After a restart, the session continues (the session id is in `.data/web-session.json`).
- [ ] The web room works on a phone-sized window (drawer opens, composer fits).
- [ ] If you enabled the pet, a bubble appears when she speaks.
- [ ] Optional: `/companion-window/` loads and the pet menu opens an Electron window (not a browser tab).

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Preset list has no 大肥鱼 | core bundle not enabled, or patch not loaded | Check Plugins page for errors; restart; confirm `dsh` bundle row. |
| `Cannot find package '@dsh-companion/core'` | web installed without core | Install core; confirm the profile's `node_modules/@dsh-companion/core`. |
| Web 404 at `/companion/` | base mismatch | The web config's `base` must match the URL; default `/companion`. |
| Window 404 or blank | web plugin missing, or `chatBase` wrong | `chatBase` must match the web `base` (`/companion`). |
| Port 4318 in use | another process | Change `port` or set `0`; DSH's own port still works. |
| Her replies are empty / stuck | provider down or model name wrong | Check DSH's model settings and logs; the UI shows the turn reason. |
| Compaction logs "找不到宿主的 @deepseek-ai/dsh-compaction-basic" | DSH version/layout changed | Set `DSH_HOST_MODULES` to the `@deepseek-ai` directory, or update the plugin. |
| She talks like a generic assistant | persona not loaded | Confirm `persona.md` is non-empty and `home` points at the right directory. |
| Notes are not saved | home not writable | Check permissions; the plugin logs the file error in the turn context. |

## 10. Uninstall

1. Disable/remove the bundles in the Plugins page.
2. Restart.
3. The home directory is yours; delete it only if you want to lose the persona and memories. Back up `persona.md`, `notebook.md`, `diary/`, and `.data/memory/` first.

Removing the web bundle leaves the brain and the preset intact. Removing core removes the preset; the web plugin will fail to create a session, so remove both together.
