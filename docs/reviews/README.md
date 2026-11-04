# Reviews

This release was gated by five reviews. They are not marketing copy: each one lists what was checked, what was found, what changed, and what is still open.

| Review | Scope | Before | After | Status |
|---|---|---:|---:|---|
| [Architecture](architecture.md) | boundaries, config, failure isolation, security, data model, testability | 62 | **88** | Pass with known risks |
| [UI](ui.md) | visual system, layout, responsive, accessibility, states | 70 | **90** | Pass |
| [Interaction](interaction.md) | first run, send/receive, interruption, proactive, errors | 68 | **82** | Pass with deferred items |
| [Function](function.md) | feature inventory, edge cases, API contract, tests | 72 | **84** | Pass |
| [Product](product.md) | users, value, differentiation, scope, licensing, launch | 65 | **80** | Pass with open questions |

Weighted score: **85.4 / 100** (architecture 30%, UI 20%, interaction 20%, function 15%, product 15%).

## Method

1. **Inventory** — read every file in the four packages; list every tool, route, file, and external dependency.
2. **Trace** — follow one message end to end (browser → web → delivery → DSH session → core prompt → model → SSE → browser).
3. **Adversarial pass** — try to break it: cross-site requests, path traversal, 4 MB images, empty home, corrupt JSON, missing host packages, port conflicts, model failures, 300-message history.
4. **Run it** — unit tests, a fake-context boot of the core plugin, the real UI against the demo server, desktop + mobile screenshots.
5. **Fix or record** — every finding gets a status: `fixed`, `accepted`, `deferred`, or `won't fix`. A release does not require zero findings; it requires no unrecorded ones.

## Severity

| Level | Meaning | Release rule |
|---|---|---|
| S1 | Data loss, security hole, or the plugin cannot start | Must be fixed |
| S2 | A core flow is broken or misleading | Must be fixed or explicitly disabled |
| S3 | Quality/accessibility/performance issue | Fix if cheap; otherwise record |
| S4 | Nice to have | Roadmap |

## What "verified" means in this repo

The four shipped packages were extracted from a daily-use DSH setup. Unit tests and a demo server were added so that a contributor can verify the core without that setup. Items that were not exercised in the extracted copy are marked **beta** in [../verification.md](../verification.md), not silently claimed as verified.

## Deliberate exclusions

- The old in-DSH chat tab: deprecated; replaced by the web room.
- The Chrome MCP: documented as [extras/chrome](../../extras/chrome) rather than shipped as a package; it is mostly configuration around someone else's MCP server.
- The private persona/diary/memories: never published. The repo ships an original example character and demo data.

These are product decisions, recorded in [../../ROADMAP.md](../../ROADMAP.md), not accidental omissions.
