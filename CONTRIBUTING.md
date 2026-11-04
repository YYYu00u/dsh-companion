# Contributing

Thanks for taking a look. This project is small on purpose; the fastest way to help is to run it, break it, and tell us exactly how.

## Before you start

- Read [README.md](README.md) and [docs/architecture.md](docs/architecture.md).
- Check the [verification matrix](docs/verification.md) — some features are explicitly beta.
- For a change to `persona.md` semantics, the memory schema, or the home layout, **open an issue first**. Those are expensive to migrate.
- For UI/a11y fixes, a screenshot or a short recording is worth more than a paragraph.

## Development setup

```bash
git clone https://github.com/YYYu00u/dsh-companion.git
cd dsh-companion
node scripts/link-workspace.mjs   # links packages for tests without pnpm
npm test                          # 24 tests
npm run check                     # syntax, manifests, secrets/paths
npm run demo                      # http://127.0.0.1:4319/companion/
```

Requirements: Node.js 20+. The plugins themselves run inside DeepSeek Harness; you do not need DSH to work on the UI, the memory store, or the delivery layer.

To exercise the real presets, install the packages into a DSH 0.2.1-rc.5 profile (see [docs/install.md](docs/install.md)). **Do not test against someone's real home.** Use a temp home:

```bash
node scripts/init-home.mjs --home /tmp/companion-test --name 测试鱼
```

## What to contribute

Good first issues:

- Keyboard/a11y gaps listed in [docs/reviews/ui.md](docs/reviews/ui.md) and [interaction.md](docs/reviews/interaction.md).
- Documentation fixes, especially install steps for your DSH version.
- Tests for pure functions that are not covered yet (history reconstruction, senses parsing, config validation).
- A screen-reader pass (VoiceOver/NVDA) with concrete findings.
- An English UI pass: the server strings are Chinese-first; a locale layer would be welcome, but discuss the design first.

Please avoid drive-by refactors of the memory or compaction code. It is the part with the least test coverage and the most hidden state.

## Code style

- ESM only, no build step for the server packages.
- No new runtime dependencies unless there is no reasonable alternative. The demo uses only Node built-ins.
- Prefer plain files and small functions over a framework.
- Comments may be Chinese or English; user-facing strings are currently Chinese. Keep identifiers English.
- Atomic writes: use `writeFileAtomic` for anything under the home.
- Do not log secrets, raw turns, or the contents of `.data/config.json`.
- Keep the public API additive. A config key that changes defaults needs a migration note.

## Tests

- Add a test for every pure function you change.
- For UI changes, run `npm run demo` and take a screenshot at 1600×900 and 390×844.
- For a new route or tool, add it to the relevant table in `docs/reviews/function.md` and, if it can fail, a row in the edge-case table.
- `npm run check` must pass: no personal absolute paths, no old private scope, no keys, no stale names.

## Pull requests

A PR should include:

- What problem it solves, and who hits it.
- What you verified (commands, screenshots, DSH version).
- Any new config key, with its default and docs.
- Any behavior that is now different for existing homes.

Keep PRs focused. A PR that mixes a memory change, a UI restyle, and a dependency bump is hard to review and harder to revert.

## Commits

Conventional-ish messages are welcome but not enforced. Examples:

```
fix(web): reject cross-site POSTs
feat(core): seed a home on first run
docs(memory): explain the forgetting curve
```

## Code of conduct

By participating you agree to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
