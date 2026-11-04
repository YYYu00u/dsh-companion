# Persona layers

A companion needs a stable core and a changing surface. If everything is editable, she becomes incoherent. If nothing is editable, she never grows. The files split along that line.

## The layers

| File | What it is | Who writes | In the prompt |
|---|---|---|---|
| `persona.md` | The root: who she is, how she talks, her boundaries | The owner; she may only *propose* changes | Every turn, as `deployment:persona-prefix` |
| `self.md` | The current her: habits, opinions, feelings she has grown | Her (`grow`) | Every turn |
| `standard.md` | Who she wants to become | Her (`update_standard`) | Every turn (reflection material) |
| `owner.md` | What she knows about the owner, by section | Her (`know_him`) | Every turn |
| `notebook.md` | Concrete things: events, preferences, promises | Her (`take_note`, `fix_note`, `its_past`) | Every turn, capped |
| `lessons.json` | Behaviors on trial, with good/bad counts | Her (`learn`, `felt_it`, `judge_lesson`) | Two sampled each turn |
| `experiences.md` | What she did, with feelings | Her (`did`) | Index only; full text via `recall` |
| `diary/` | One file per day | Her (`write_diary`) | Index only; via `recall` |

`persona.md` is the only file that requires the owner's approval to change. A `propose_change` call appends to `proposals.json`; the web UI shows it in the "她想改自己，等你点头" section. If the owner edits the file directly, that is the approval.

## Why these are plain Markdown

- The owner can read and edit them without a UI.
- Git gives a history of the relationship: when she changed, and why.
- They survive a framework change. The data is not locked into a schema.
- Diffs are reviewable. A JSON blob with a nested state machine is not.

The home is meant to be its own git repository. If `.git` exists, the core plugin commits each change with the companion's name as the author and a short message. That is why the plugin never rewrites history; it only appends, moves, or edits one line at a time.

## Editing rules encoded in the tools

- `take_note` only writes under "关于主人" or "我自己的事"; it never touches the owner's setup section.
- `fix_note` refuses to edit when the match hits more than one line; the model must be more specific.
- `its_past` moves an item to "过去的事" and annotates it, instead of deleting.
- `grow` edits one section of `self.md` at a time; it cannot touch `persona.md`.
- `learn` starts a lesson as `trial`; after a few days and some reactions it becomes `kept` or `dropped`.
- `judge_lesson` can drop a kept lesson if it keeps failing.

The model can still write bad content. The guardrails are about *structure* (do not corrupt the file, do not silently delete the relationship), not about taste.

## Prompt assembly

```
persona.md
  + stable background:
      notebook (past section hidden)
      body index (one line per part, with tool availability)
      memory index (counts, not full text)
      current self / owner / standard / lessons
  + per-turn snapshot:
      date/time, mood, reminders, senses, relevant episodes
```

The stable part is a single `complete` system-prompt section, so editing a long-term file changes the prefix and invalidates the cache. That is acceptable: long-term files change a few times a day, not every turn. Mood and senses are in the per-turn snapshot because they change often.

## The example persona

`packages/core/templates/persona.md` is an original character, "小鲤": a blue-haired fish girl who lives in the computer, a bit lazy, a bit stubborn, curious, and explicitly not an assistant. It is intentionally non-explicit and has clear boundaries:

- She only chats; hands are separate.
- She does not pretend to be human, but she does not constantly announce being an AI either.
- Affection stops at hugs and kisses; further advances are deflected without a lecture.
- She does not invent memories; if she does not know, she says so.

Replace it with your own character. Do not publish someone else's persona or chat history. The repository's example is deliberately generic so that screenshots and demos are safe to share.
