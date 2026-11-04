# Function review

**Score: 84 / 100** (before: 72) — pass.

## Scope

Every shipped tool, route, and scheduled behavior; edge cases; API contracts; persistence and recovery; test coverage. Not reviewed: whether the character is *likeable* (product), visual presentation (UI), or performance under many users (not a goal).

## Feature inventory

### Core preset

| Area | Tools / behavior | Status |
|---|---|---|
| Persona | Re-read `persona.md` every turn; root changes require a proposal | Verified |
| Notebook | `take_note`, `fix_note`, `its_past`; 12k cap; past section hidden | Verified (tests) |
| Mood | `feel`; 0–100 with base layer, half-life, ten feelings | Verified |
| Reminders | `keep_in_mind`; life module asks when due | Verified |
| Diary / reflection | `write_diary`, `learn`, `judge_lesson`, `felt_it` | Beta — depends on the evening turn completing |
| Lessons | Thompson sampling, trial/kept/dropped, reaction feedback | Verified in logic; field tuning ongoing |
| Self / standard | `grow`, `update_standard`, `propose_change` | Verified |
| Owner model | `know_him`; sections; evening rewrite | Verified |
| Wants / experiences | `want_to`, `did`, `let_go`, `post_moment` | Verified |
| Stickers | `keep_sticker`, `edit_sticker`, `find_sticker`; aliases, meta, selection, sent/judged | Beta — model must emit `[表情:name]` |
| Surf | `hot_list`, `hot_comments`, `pick_up` | Verified (network-dependent) |
| Social | `douyin_feed`, `douyin_hot`, `tieba_posts`, `tieba_thread`; daily budgets | Beta — endpoints can change |
| Images | `find_pic`, `look_pic`, `keep_pic` | Beta — search quality varies |
| Body / memory | `look_body`, `recall`, `wish`; availability from real tools | Verified |
| Hands | `use_hands`; child session; `read_skill`, `save_skill`, `wish` | Beta — needs Chrome MCP |
| Memory | turn archive, episode extraction, BM25 recall, `look_back`, compaction | Beta — store verified; compaction needs a fresh-install E2E |
| Activity level | 0–4 budgets | Verified |

### Web plugin

| Area | Behavior | Status |
|---|---|---|
| Chat API | `POST /api/send`, SSE `/api/events`, `/api/history` | Verified |
| Mind API | `/api/mind`, `/api/level`, `/api/reflect` | Verified |
| Images | `/api/sticker/<name>`, `/api/pic/<id>`, upload validation | Verified |
| Delivery | debounce, split, rhythm, interruption, typo, sticker | Verified (tests) |
| Daily life | remind / reflect / own / nudge, budgets, quiet hours, rollback | Verified in logic; field use |
| Senses | front app, idle, lock; macOS commands | Beta — macOS-specific |
| Exam | optional judge + corpus | Beta — opt-in |
| Multi-persona | `people` → `/p/<id>/`, separate homes/presets | Beta — config surface is new |
| Pet | optional dsh-pet broadcast | Beta — opt-in |

### Search plugin

| Area | Behavior | Status |
|---|---|---|
| Provider | `bing` registered into `ctx.web` | Verified |
| Parsing | titles, wrapped URLs, snippets, dedupe | Verified (tests) |
| Failure | no parse → explicit error, never fabricated results | Verified |

## Edge cases and how they are handled

| Case | Behavior |
|---|---|
| Empty message | 400 "消息是空的" |
| Text > 4000 chars | 400 "太长了" |
| Image > 4 MB | 400 "图太大了，4MB 以内" |
| Body > 7 MB | 413 |
| Non-image data URL | 400 "只能发 png、jpg、webp、gif" |
| Unknown sticker name in send | 400 "没有这个表情" |
| Unknown sticker emitted by model | line dropped, no broken image |
| Pic id not `s-<10 hex>` | 404 |
| Static path traversal (`../`) | rejected by regex + `existsSync` |
| Cross-site POST | 403 via `Sec-Fetch-Site` |
| Corrupt JSON state | readers return defaults; atomic writes avoid partial files |
| Missing home | seeded on boot |
| Missing/empty persona | clear throw, not a silent generic assistant |
| Port busy | warning; DSH-port route still works |
| Model/provider failure | turn reason surfaced; life counters rolled back |
| Episode extraction failure | rough episode with `rough: true`; compaction continues |
| Host package missing | loud `hostdeps` error; documented |
| Restart | session id restored from `.data/web-session.json` |
| History > 300 rows | last 300 returned; older data stays in the DSH log |
| Same sticker image re-kept | becomes an alias, not a duplicate file |
| Home is a git repo | each note/lesson/event is committed with the companion identity |

## API contract (web)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/who` | — | `{name, main, modules}` |
| GET | `/api/history` | — | `{rows, busy}` |
| GET | `/api/events` | — | SSE: `row`, `typing`, `idle`, `mind` |
| POST | `/api/send` | `{text, image?, sticker?}` | `{ok}` or `{error}` |
| GET | `/api/mind` | — | mood, diary, moments, lessons, exams, proposals, wants, experiences, senses, owner, knows, body, skills, wishes, life |
| GET/POST | `/api/level` | `{level}` | level + descriptions |
| POST | `/api/reflect` | — | 202 / 403 / 409 |
| GET | `/api/stickers` | — | `{stickers: string[]}` |
| GET | `/api/sticker/<name>` | — | image |
| GET | `/api/pic/<id>` | — | image |

All JSON responses are `no-store`; images are cached for an hour. The API has no version prefix; it is a local single-client API, not a public contract.

## Tests

| Suite | Count | Notes |
|---|---:|---|
| config | 4 | home, `~`, defaults, idempotent seed |
| notebook | 5 | past hiding, cap, move, fix, multi-match refusal |
| level | 2 | default, validation |
| memory | 4 | tokenize, day boundary, bouts, ranking/strength |
| core apply smoke | 1 | real `apply()` with a fake ctx, expected tools |
| web apply smoke | 1 | web `apply()` boots with no DSH session |
| delivery | 5 | split, sticker, gap, typo, ordered send |
| life | 2 | own-time variety, rollback |
| Bing | 2 | parse, empty page |
| **Total** | **26** | `npm test` |

Not covered: HTTP routes (would need a DSH harness), session events, model calls, exam, hands, multi-persona, macOS senses.

## Findings

| ID | Sev | Finding | Status |
|---|---|---|---|
| FUNC-01 | S2 | No test harness for a contributor without DSH | **Fixed**: fake ctx + demo server |
| FUNC-02 | S2 | Cross-site POST could trigger sends/level changes | **Fixed** |
| FUNC-03 | S2 | Failed proactive turns consumed budget | **Fixed** |
| FUNC-04 | S3 | Exam failed without a clear reason when corpus missing | **Fixed**: explicit skip reason |
| FUNC-05 | S3 | Sticker panel showed raw `[表情:x]` if the image was missing | **Fixed**: dropped |
| FUNC-06 | S3 | Compaction failure could block the preset | **Accepted**: loud failure; documented |
| FUNC-07 | S3 | No end-to-end test for the compaction path | **Deferred**: manual checklist in verification |
| FUNC-08 | S3 | Social endpoints are scraped and can change | **Accepted**: budgets + clear errors; no login |
| FUNC-09 | S4 | No pagination for history | **Deferred** |
| FUNC-10 | S4 | No retry for failed turns | **Deferred** |

## Verdict

The feature surface is broad but the stable path is narrow and tested: chat, notebook, mood, memory, delivery, and the web API. The beta features are clearly labeled and degrade with a reason instead of crashing. **Pass.**
