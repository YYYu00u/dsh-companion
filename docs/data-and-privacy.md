# Data and privacy

## What stays local

Everything the companion knows is in one directory (`home`, default `~/.dsh-companion`). There is no database, no cloud sync, and no telemetry.

| Path | Content | Git-ignored | Sensitive |
|---|---|---|---|
| `persona.md` | Character root | no | Often personal |
| `notebook.md` | Facts and promises | no | Yes |
| `owner.md` | What she knows about you | no | Yes |
| `self.md`, `standard.md` | Her evolving self | no | Personal |
| `diary/` | Daily diary | no | Yes |
| `experiences.md`, `moments.md` | What she did / posted | no | Yes |
| `stickers/` | Images and descriptions | no | Possibly |
| `lessons.json`, `wants.json`, `reminders.json`, `slang.json` | Behavior/preference state | no | Yes |
| `body/`, `skills/` | Body index and procedures | no | Usually not |
| `.data/memory/turns.jsonl` | Every archived turn | **yes** | Yes |
| `.data/memory/episodes.jsonl` | Extracted episodes | **yes** | Yes |
| `.data/mind/*` | Mood, counters, senses | **yes** | Yes |
| `.data/stickers-in/` | Images you sent | **yes** | Possibly |
| `.data/web-session.json` | DSH session id | **yes** | No |
| `.data/config.json` (if present) | Provider keys | **yes** | **Never share** |

The plugin never reads `.data/config.json`; it is listed here because that is where DSH/provider tooling may keep credentials. Do not print it, commit it, or paste it into an issue.

## Outbound traffic

- The model requests DSH would send anyway, with the companion prompt and recent context.
- `web_search` / `web_fetch` when she (or the reflection) chooses to browse.
- The Chrome MCP when the hands are used: the pages the task requires.
- No analytics, crash reporting, update check, or "phone home".

The web UI loads only same-origin assets; there are no third-party CDNs or fonts.

## The web server

- Binds to `127.0.0.1` only. It is not reachable from the LAN by default.
- Has **no authentication**. Anyone with local access (or any process on the machine) can read the API.
- Rejects state-changing requests with `Sec-Fetch-Site: cross-site` or `same-site`, which blocks CSRF from a random website. It does not block `curl`; that is intentional for local scripting.
- Sends CSP, `nosniff`, `no-referrer`, and `DENY` framing headers.
- Do not expose the port through a tunnel or reverse proxy. If you need remote access, put it behind an authenticated VPN/reverse proxy and understand that the API exposes the full notebook and diary.

## Backups and export

Because the state is plain files:

```bash
# Full backup, including raw memory
tar -czf companion-backup.tgz ~/.dsh-companion

# Shareable "character" export (no raw turns, no senses, no uploads)
tar -czf companion-character.tgz \
  -C ~/.dsh-companion persona.md notebook.md owner.md self.md standard.md \
  diary experiences.md moments.md lessons.json wants.json reminders.json slang.json \
  body skills stickers
```

Import is the reverse: put the files in a fresh home (or use `scripts/init-home.mjs` and overwrite). The plugin seeds missing files on boot.

## Deleting data

- Delete a file: the plugin falls back to defaults on the next read (and may re-create the seed if the file is required).
- Delete `.data/memory/`: she loses episodic memory and the raw archive; the notebook and long-term files remain.
- Delete the whole home: a fresh character, no memories. Back up first.

## Git

The home can be its own git repository. If `.git` exists, the core plugin commits changes as the companion:

```
git -C ~/.dsh-companion log
```

`.data/` is ignored by the seeded `.gitignore`, so raw turns and mood state do not enter the character's history. If you want a full backup, use the tarball method above; git is for the *character*, not the runtime.

Never commit a home that contains someone else's diary or persona. The repository's example persona is original and non-explicit for exactly this reason.

## Content and safety

- The example persona is non-explicit and has boundaries (affection stops at hugs/kisses; no impersonation of a human when asked).
- The `use_hands` prompt forbids spending money, deleting data, changing passwords/account settings, and sending private messages unless the task explicitly says so.
- The companion has no shell/file tools, so a prompt injection in a web page cannot directly run commands. It can still influence what she says; treat browsed content as untrusted.
- This is a character, not a therapist or a substitute for human relationships. If you or someone else is using it in a way that causes distress, stop and talk to a person.

## Reporting a privacy issue

Open a private security advisory (see [SECURITY.md](../SECURITY.md)) rather than a public issue if the report includes personal data or an exploitable path.
