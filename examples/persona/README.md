# Example persona

This is a filled-in version of `packages/core/templates/persona.md`. The plugin seeds the template on first run; this file shows what a finished character looks like so you can copy the shape.

```bash
node scripts/init-home.mjs --home /tmp/my-companion --name 大肥鱼
cp examples/persona/persona.md /tmp/my-companion/persona.md
cp examples/persona/notebook.md /tmp/my-companion/notebook.md
```

Do not copy this character into a public repo if you have added private details. The example is intentionally generic and non-explicit.

## What makes a good persona file

- **A point of view.** "A bit lazy, a bit stubborn, curious" gives the model something to play. A list of adjectives does not.
- **Speech rules.** Short lines, no bullet lists, no "as an AI". Concrete beats abstract.
- **Boundaries.** What she will not do, and how she deflects without a lecture.
- **A hook for the owner.** The "你们的开始" section is where the relationship becomes specific. Leave it for the owner.

## What not to put in it

- Real names, addresses, employers, or health details.
- Instructions that conflict with the host's safety rules.
- A wall of lore. The persona is the root, not the whole notebook; long background belongs in `notebook.md` or `owner.md`.
- Secrets. The file is read into every prompt and may be committed.
