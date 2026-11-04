# Roadmap

The rule for this repository: **a package ships only after it is verified.** Features can be beta, but a whole package that has not been run end-to-end stays out.

## v0.1 — verified core (shipped)

- Core preset, web room, Bing search.
- Home bootstrap, config, tests, demo, docs, five reviews.
- Explicit beta list in [docs/verification.md](docs/verification.md).

## v0.1.x — field fixes

- Confirm the beta items with outside users (compaction, people, exam, hands, stickers).
- Fix install friction reported against specific DSH builds.
- Accessibility: axe run + screen-reader notes.
- Documentation: a 60-second demo recording, a troubleshooting FAQ.

## v0.2 — continuity and onboarding

Candidates, in order of expected value:

1. **Persona onboarding** — she asks a short set of questions, drafts `persona.md`, the owner approves. This is the biggest drop-off after install.
2. **Memory quality** — supersession (`updates`), reflection reads today's episodes, two-hop links with a discount. Measure before adding embeddings.
3. **Home schema version** — `schemaVersion` + a migration script before anyone has years of data.
4. **History pagination** and a retry affordance that cannot double-send.
5. **Locale layer** for the UI strings (Chinese-first today).

## v0.3 — embodiment (only if verified)

- Desktop window plugin: install it, verify focus/single-instance/fallback, then decide.
- Pet animations tied to mood (the pet API supports `anim`).
- Voice: macOS `say` or the pet's `/voice/speak` for her replies; STT only if it is local and reliable.
- A user-supplied Live2D/3D skin. The repo's 2D art is a demo, not a platform.

## Later — integrations

- QQ/OneBot: only with admin allowlists, tool hiding, cross-session context, and a security review.
- A read-only Bilibili/hot-list tool with caching and rate limits.
- A token/cost dashboard (read DSH's own stats).
- A small local model for the "how would he react" predictor, replacing the nightly exam.

## Non-goals

- A hosted service, accounts, or cloud sync.
- A general role-play frontend or character-card marketplace.
- Multi-user tenancy.
- Fine-tuning in the plugin.
- Shipping unverified packages to make the repo look bigger.
