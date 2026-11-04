# @dsh-companion/core

The brain: a chat-only DSH preset with a persona, a notebook, moods, episodic memory, stickers, a body index, and optional hands.

## What it registers

- A system-prompt section from `persona.md` (re-read every turn).
- A stable background: notebook, body index, memory index, self/owner/standard/lessons.
- Per-turn context: mood, reminders, senses, relevant episodes.
- Tools: `take_note`, `fix_note`, `its_past`, `feel`, `keep_in_mind`, `write_diary`, `learn`, `judge_lesson`, `felt_it`, `update_standard`, `propose_change`, `grow`, `know_him`, `want_to`, `did`, `let_go`, `keep_sticker`, `edit_sticker`, `find_sticker`, `hot_list`, `hot_comments`, `pick_up`, `douyin_feed`, `douyin_hot`, `tieba_posts`, `tieba_thread`, `find_pic`, `look_pic`, `keep_pic`, `look_body`, `recall`, `wish`, `use_hands`, `look_back`.
- A memory hook: archive turns, recall episodes, `look_back`.
- A compaction entry (`./compact`) that subclasses DSH's basic compaction engine.

## Install

The package ships `cordis.patch.yml` with two presets (`dsh-companion`, `dsh-companion-hands`). Install it as a DSH bundle; the preset uses:

```yaml
home: ~/.dsh-companion
name: 小鲤
```

On first run, `ensureHome()` seeds the home from `templates/`. See [../../docs/install.md](../../docs/install.md).

## Exports

```
@dsh-companion/core            # preset entry
@dsh-companion/core/config     # path/home helpers
@dsh-companion/core/mind       # mood, diary, lessons, stickers helpers
@dsh-companion/core/level      # activity levels
@dsh-companion/core/body       # body/skills/recall
@dsh-companion/core/stickers   # sticker library
@dsh-companion/core/hands      # hands preset entry
@dsh-companion/core/compact    # compaction plugin
```

`web` imports these instead of relative paths. Keep the exports additive.

## Test

From the repo root:

```bash
npm test -- packages/core
```

The core smoke test (`test/apply.test.js`) runs the real `apply()` against a fake ctx; it does not need DSH, but the compaction entry does (it imports host packages).
