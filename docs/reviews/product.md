# Product review

**Score: 80 / 100** (before: 65) — pass, with open questions.

## The problem

People who use an AI companion for months hit a wall: the character resets. Context compaction turns the relationship into a summary; the persona is a prompt you cannot edit; the memories live on someone else's server; the "proactive" messages are a cron job.

The interesting product is not "chat with a character". It is **continuity you own**:

- a character file you can edit and version;
- memories that survive compaction, in a form you can inspect;
- a life that continues when you are not looking, with budgets so it does not become noise;
- a clean line between the companion and your actual work tools.

## Who it is for

| User | Need | Fit |
|---|---|---|
| DSH power user | A companion inside the tool they already use, with their own model/provider | Primary |
| Companion tinkerer | A readable reference for persona/memory/proactivity, not a black box | Primary |
| Privacy-sensitive user | No account, no cloud, plain files | Primary |
| Non-technical user | A polished app with a one-click install | Weak — install is still developer-grade |
| Role-play community | Character cards, group scenes, lorebooks | Not targeted |

The primary user is comfortable editing YAML and Markdown. That is a deliberate constraint: it keeps the data model honest and the surface small.

## Differentiation

| Product type | What it optimizes | What this does differently |
|---|---|---|
| Character.AI / Replika | Hosted character, zero setup | Local files, own model, editable persona |
| SillyTavern | Role-play frontend, cards, many models | Not a frontend; a preset + memory + life inside DSH |
| AIRI / desktop companions | Avatar, voice, embodiment | Starts from memory/continuity; avatar is a later layer |
| MaiBot / QQ bots | Group chat, plugins | One-to-one continuity; no group/QQ scope in v0.1 |
| Mem0 / Letta | Memory infrastructure | A complete companion, with the memory as one layer |

The defensible part is the **combination**: editable persona + episodic memory tied to compaction + a daily life with budgets + a UI that shows the state. Any one of those is easy to copy; the integration and the data model are the product.

## Scope decision

Shipped and verified:

- core preset (persona, notebook, mood, memory, stickers, body, optional hands)
- web room (chat, SSE, notebook, mood tank, diary, activity, 中/EN)
- desktop window (page + Electron verified; pet menu beta)
- Bing search provider

Excluded, with reasons:

| Candidate | Why not in v0.1 |
|---|---|
| Old in-DSH chat tab | Deprecated; the web room replaced it |
| Chrome MCP | Documented as [extras/chrome](../../extras/chrome); it is someone else's MCP plus config, not a package |
| QQ / OneBot | Security and identity work (admin users, tool hiding, cross-session context) is not done |
| Voice / TTS | No verified path; belongs after the core is stable |
| Live2D / 3D | Art pipeline is not part of the plugin; the current 2D art is a demo skin |
| Vector memory | Not justified at this corpus size; see memory design |

This is a small release on purpose. A repo that claims a dozen verified plugins and ships two is worse than one that ships four honestly.

## Onboarding

Current funnel:

1. See a screenshot / README.
2. Clone, run `init-home`.
3. Install core + web (window optional), restart, pick a preset.
4. Edit persona, say hello.
5. Open the web room.

Drop-off risks:

- **Step 3** is the hardest. DSH's plugin manager is the right place, but the docs must stay in sync with its labels.
- **Step 4** is where the product becomes personal. The example persona is intentionally generic; users must write. A guided `persona` interview (she asks you questions and writes the file) would be a strong v0.2 feature.
- **Step 5** is the "wow" moment. The README leads with it for that reason.

## Ethics and safety

- The companion is warm but explicitly a character. The persona prompt says not to pretend to be human when asked, and not to invent memories.
- Affection is bounded at hugs/kisses in the example. Users can change it; the repo does not ship explicit content.
- No engagement metrics, streaks, notifications at night, or dark patterns. The activity level can be set to "chat only".
- The hands prompt forbids spending money, deleting data, changing credentials, and private messages unless the task says so.
- Emotional dependency is a real risk. The docs say it plainly; the product does not guilt the user for leaving.
- Privacy: no telemetry, local-only API, explicit warning not to expose the port.

## Licensing and sustainability

- Code: MIT. Art: excluded from MIT, documented in NOTICE. Corpus: not redistributed.
- No monetization in v0.1. A hosted "memory sync" or a managed character marketplace would conflict with the local-first promise; if it ever exists, it should be optional and exportable.
- Maintenance: one main maintainer. The test suite and demo server are the bus factor mitigation. The roadmap should favor small, reviewable changes over a grand architecture.

## Launch plan

1. **Private review** — run the five reviews, fix S1/S2, tag `v0.1.0-rc.1`.
2. **Public repo** — README with screenshots, install doc, demo, CI green.
3. **Show, don't tell** — a 60-second screen recording: send a message, open the notebook, change the mood, restart and continue. No claims that are not in the verification matrix.
4. **Communities** — DSH plugin list, companion-dev communities, Chinese AI-tool circles. Lead with the architecture/memory write-up, not "AI girlfriend".
5. **Feedback loop** — issues template asks for DSH version, install path, and logs; a `good first issue` set around UI/a11y and docs.
6. **v0.2** — persona onboarding, memory quality, and the window plugin; the window shipped in 0.2.0, so the next decision is polish vs. voice/avatar.

## Success metrics

Stars are a lagging, noisy signal. Better:

- install-to-first-reply completion (self-reported / issue volume);
- issue ratio of install problems vs. feature requests;
- percentage of users who keep the default persona vs. write their own;
- beta items that get confirmed by at least one outside user;
- contribution: at least one external PR merged in the first month.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DSH API changes and compaction breaks | Medium | High | Loud failure, version pin, smoke checklist |
| Install friction kills adoption | High | Medium | Docs, demo, plugin-manager path; future CLI |
| "AI girlfriend" framing attracts the wrong audience | Medium | Medium | Lead with architecture/continuity; explicit ethics section |
| Single maintainer burnout | Medium | High | Tests, demo, small scope, roadmap |
| Privacy incident from an exposed port | Low | High | Loopback default, warnings, no auth by design |
| Model cost surprises | Medium | Medium | Levels, budgets, `modules: []`, docs |
| Persona content becomes harmful | Low | Medium | Boundaries in example, owner responsibility, no hosted service |

## Open questions

1. **Is the web room the product, or is the preset?** The current answer is both, with the preset as the durable layer. If users mostly want the room, the next investment is UI; if they mostly want the brain, it is memory quality.
2. **Should the companion be able to install plugins / grow tools?** The wishlist + hands is a cautious version of this. Full self-extension is a security and product cliff; not in v0.1.
3. **How much should she remember that the user did not say?** Senses (front app, idle) are useful but creepy if unlogged. The current design shows them in the notebook; keep it visible.
4. **What is the migration story for a persona?** Plain files make export easy; schemas are the risk. A `schemaVersion` in the home would help before 1.0.

## Verdict

The product has a clear position, a coherent scope, and an honest launch story. The main weaknesses are install friction, single-maintainer risk, and the fact that the most emotionally important behavior (memory/life over weeks) is exactly what a new repo cannot prove. The roadmap addresses all three. **Pass**, with the open questions above.
