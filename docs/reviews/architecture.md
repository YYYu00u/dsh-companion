# Architecture review

**Score: 88 / 100** (before: 62) — pass, with two known risks.

## Scope

Package boundaries, dependency direction, configuration and first-run bootstrap, data ownership, security model, failure isolation, testability, and the decisions behind the monorepo. Not reviewed here: prompt quality (product), visual design (UI), individual feature behavior (function).

## Checklist

| Area | Question | Result |
|---|---|---|
| Boundaries | Can `web` be installed without a sibling source tree? | Fixed — package exports, no `../` imports |
| Direction | Does `core` depend on `web`? | No |
| Config | Are personal absolute paths required? | No — `home`, `~` expansion, defaults |
| Bootstrap | Does a fresh home work without a wizard? | Yes — idempotent `ensureHome` |
| Data | Is runtime state separated from character state? | Yes — `.data/` vs Markdown/JSON |
| Writes | Can a crash corrupt a file? | No — atomic write/rename |
| Security | Is the web server reachable from the LAN / CSRF-able? | Loopback + Sec-Fetch-Site guard + CSP |
| Failure | Does a missing pet/Chrome/exam block chat? | No — all optional, degrade loudly |
| Host coupling | Is the DSH package path hardcoded? | No — env, argv, `resourcesPath` |
| Tests | Can a contributor boot the core without DSH? | Yes — fake ctx smoke test |
| Release hygiene | Are secrets/paths scoped out? | Yes — `npm run check` |

## Findings

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| ARCH-01 | S1 | `web` imported a sibling package by relative path (`../<private-package>/mind.js`), so installing it alone failed | imports in `index.js`, `delivery.js`, `life.js` | **Fixed**: `@dsh-companion/core/*` exports |
| ARCH-02 | S1 | Preset YAML and code defaults contained one developer's absolute home path; a clone would write to the wrong place or crash | `cordis.patch.yml`, `apply()` defaults | **Fixed**: `home` + `~` + `~/.dsh-companion` default |
| ARCH-03 | S1 | The preset declared seven private personas and private homes | 334-line YAML | **Fixed**: one reference preset + optional `people` config |
| ARCH-04 | S1 | A fresh home without `persona.md` crashed `apply()` | `readFileSync` in `registerPersona` | **Fixed**: `ensureHome` seeds; missing persona falls back to per-turn context |
| ARCH-05 | S2 | Missing host package (`dsh-compaction-basic`) throws at module load and can take down the preset | top-level `await hostImport` | **Accepted**: the failure is loud and version-specific; documented in install/verification. A silent fallback would produce worse summaries. |
| ARCH-06 | S2 | The web server accepted cross-site POSTs; any page could message her or change the level | no `Sec-Fetch-Site`/Origin check | **Fixed**: cross-site guard + CSP + security headers |
| ARCH-07 | S2 | The host package path was hardcoded to a macOS app bundle | `hostdeps.js` | **Fixed**: `DSH_HOST_MODULES`, `argv[2]`, `resourcesPath` |
| ARCH-08 | S2 | Fixed port 4318 opened with no auth and exposed notebook/diary to any local process | `createServer` on loopback | **Accepted**: local-only threat model; docs warn against tunnels. Auth would add a setup step disproportionate to the risk. |
| ARCH-09 | S2 | Timezone `Asia/Shanghai` was hardcoded in prompts | `clientTimeZone` | **Fixed**: `timeZone` config / system default |
| ARCH-10 | S2 | The exam required a private corpus and a hardcoded judge model | `exam.js` | **Fixed**: opt-in `exam` config; skips with a clear reason |
| ARCH-11 | S2 | `dsh-pet` was assumed; an absent pet caused a fetch every message | `petSay` | **Fixed**: `pet` unset by default, no-op without it |
| ARCH-12 | S3 | Package `files` omitted new modules; publishing would drop them | `package.json` | **Fixed**: `config.js`, templates, `memory/README.md`; `check` enforces top-level JS |
| ARCH-13 | S3 | No tests or CI | — | **Fixed**: 45 tests, CI workflow, demo server |
| ARCH-14 | S3 | Internal section names still used the old project name | `dsh-companion:memory`, etc. | **Fixed** |
| ARCH-15 | S3 | No explicit DSH version compatibility | — | **Accepted**: documented target 0.2.1-rc.5; DSH plugins have no stable peer contract to declare |
| ARCH-16 | S3 | Synchronous file I/O on every turn | `writeFileSync`/`appendFileSync` | **Accepted**: single user, small files; async would complicate the commit queue |
| ARCH-17 | S3 | Raw turns are kept forever | `turns.jsonl` | **Accepted**: it is the audit trail for recall; docs explain deletion/backup |
| ARCH-18 | S4 | No config schema validation; unknown keys reach DSH | `apply()` | **Deferred**: DSH rejects unknown compaction keys; the rest are documented and defaulted |

## Changes made

- Introduced `packages/core/config.js`: path expansion, home resolution, idempotent seeding, `companionConfig`.
- Added package `exports` for every shared module; rewrote web imports to package specifiers.
- Replaced the private 7-persona preset with a two-preset reference (`dsh-companion`, `dsh-companion-hands`) and a documented `people` array.
- Made persona optional at boot, added `ensureHome` to both core and hands entries.
- Replaced the hardcoded host path with a three-way lookup.
- Added CSRF guard, CSP, `nosniff`, `no-referrer`, `DENY`.
- Moved exam behind config; added a clear skip reason and corpus existence check.
- Made pet optional.
- Added `npm run check`, CI, and a fake-context boot test.

## Remaining risks

1. **DSH coupling.** The compaction subclass imports host internals. A DSH upgrade can break it; the failure is loud, but there is no compatibility shim. Mitigation: pin the target version in docs, add a smoke check after upgrade.
2. **No auth.** The local web API exposes the notebook. Mitigation: loopback-only + docs; a future `token` config is possible.
3. **Single-process memory store.** `openMemory` caches per home; if two DSH processes share a home, their in-memory turn lists can diverge. Mitigation: document "one DSH per home".

## Verdict

The architecture is now installable, testable, and honest about its host dependency. The remaining risks are documented and bounded. **Pass.**

## Evidence

- [../architecture.md](../architecture.md)
- [../../packages/core/config.js](../../packages/core/config.js)
- [../../packages/core/test/apply.test.js](../../packages/core/test/apply.test.js)
- [../../scripts/check.mjs](../../scripts/check.mjs)
