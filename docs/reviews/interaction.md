# Interaction review

**Score: 82 / 100** (before: 68) — pass, with deferred items.

## Scope

What it feels like to use: first run, sending, receiving, interruption, stickers/images, the drawer, the activity slider, proactive messages, reflection, failures, and reconnection. Not reviewed: visual styling (UI), feature completeness (function), strategy (product).

## The flows

### First run

1. Clone → `node scripts/init-home.mjs` → edit `persona.md` / notebook setup.
2. Install two bundles → restart → pick preset → open the web room.
3. Empty chat shows "她在你电脑里打盹 / 先跟她打个招呼".

**Assessment:** the plugin cannot remove DSH's install step, but the home bootstrap removes the worst part (hand-creating a dozen files). The remaining friction is documented and has a checklist. A future `dsh companion init` command would be nicer, but it belongs in DSH, not here.

### Sending

- Enter sends, Shift+Enter newlines, IME composition is respected.
- The user's bubble appears immediately; the composer clears; the send button disables during the request.
- If the request fails, the text stays in the input and an error appears above the composer. This is the right failure behavior: never lose the user's words.
- Multiple quick lines are joined after 3 seconds (8-second ceiling). The UI does not show a "merging" state; it just feels like she waited for you to finish.

### Receiving

- "对方正在输入" appears on `turn/start`; the tank breathes faster.
- Her reply is split into bubbles and delivered with a 0.6–4 s rhythm.
- A refresh rebuilds the same bubbles from `/api/history`, including the split, so the transcript is stable.
- A parenthesized stage direction becomes an italic aside, not a speech bubble.

**Assessment:** this is the strongest part of the product. The timing is not a gimmick; it is what makes a multi-line answer feel typed rather than dumped.

### Interruption

If the user speaks while bubbles are queued, the remaining bubbles are dropped and the next prompt tells her which lines were not seen. On refresh, the unsent lines are hidden.

**Assessment:** honest and better than pretending. The downside is that the user cannot see what was dropped; a small "她还有两句没说完" affordance could help, but it would also break the illusion. Recorded as a deliberate trade.

### Proactive messages

- Reminders, own time, nudges, and reflection all arrive as narration; the user sees only her spoken reply.
- She can reply `[沉默]` and nothing is delivered.
- Quiet hours, idle floors, and daily budgets prevent spam.
- A failed proactive turn rolls the counters back.

**Assessment:** the logic is careful, but this is the least verifiable part without days of use. The rollback fix came from a real outage; that is a good sign that the failure paths were exercised.

### Stickers and images

- Sticker panel shows thumbnails and names; click sends one.
- Images can be pasted or picked, staged above the composer, then sent with text.
- Chat images open in a new tab.
- Unknown `[表情:name]` is dropped rather than shown as raw text.

**Assessment:** solid. The panel does not trap focus or close on Escape (it closes on outside click); that is a minor keyboard gap.

### The drawer

- Opens from the tank or the header; closes with 收起, Esc, or clicking outside.
- On mobile it covers the page, traps Tab, and returns focus.
- Tabs remember the last selection via `?tab=`.

**Assessment:** works. The paper texture is decorative; the content hierarchy (sections, timestamps, tags) is readable.

### Activity slider

- 0–4, saved immediately, described in one sentence.
- The snapshot shows today's counts vs. limits.

**Assessment:** good affordance, but the label "她多活跃" is vague. The description does the real work. A future version could show the token-cost implication more directly.

### Reflection

- Manual trigger via `/api/reflect` (202) or automatic after 22:30.
- Refuses if she is busy or holding messages (409), with a clear error.
- The UI updates the notebook after the turn (`mind` event).

**Assessment:** the refusal behavior is correct. The user cannot see progress during reflection; a "她在写日记" state would be nicer, but the turn indicator already covers it.

### Failures and reconnection

- SSE error → "连不上了，正在重连".
- Turn error → "她没说完（reason）".
- Port conflict → logs only; DSH-port route still works.
- History load failure → error line, not a blank page.

**Assessment:** good. There is no retry button for a failed turn; the user can resend. Adding a retry could double-send if the turn actually completed. Recorded.

## Findings

| ID | Sev | Finding | Status |
|---|---|---|---|
| IX-01 | S2 | First run required hand-creating a home | **Fixed**: `init-home` + `ensureHome` |
| IX-02 | S2 | Failed proactive turns consumed the daily budget and could make her "give up" | **Fixed**: `onTurnEnd` rollback + retry |
| IX-03 | S2 | Typing while she was sending could silently drop the tail | **Accepted**: she is told which lines were missed; history hides them |
| IX-04 | S3 | Sticker panel has no focus management/Esc close | **Deferred**: outside click works; add in a keyboard pass |
| IX-05 | S3 | No "load earlier" beyond 300 rows | **Deferred**: 300 is ~a week of heavy chat; DSH's log has the rest |
| IX-06 | S3 | No retry button for a failed turn | **Deferred**: resend is safer without turn idempotency |
| IX-07 | S3 | Reflection has no progress state | **Deferred**: the typing indicator covers it |
| IX-08 | S3 | The slider label is jargon | **Accepted**: description explains it |
| IX-09 | S4 | No unread badge/title | **Deferred** |
| IX-10 | S4 | No per-message timestamp on hover | **Accepted**: gap separators are enough |
| IX-11 | S4 | No "she didn't see this" UI for interrupted lines | **Accepted**: would break the illusion |

## Metrics to watch

These are not instrumented (no telemetry). If you want to evaluate a deployment, measure locally:

- Time from send to first bubble (target: model latency + <1 s).
- Fraction of turns that end in an error (target: <2%).
- Proactive messages per day vs. level budget (target: under 50% of budget).
- Sticker usage per 100 messages (target: 5–15 after the library is warm).
- Reflection completion rate (target: >90% of eligible days).

## Verdict

The core interaction — waiting, splitting, interrupting, failing gracefully — is thoughtfully designed and now has tests for the pure parts. The remaining gaps are secondary flows (pagination, retry, keyboard sticker panel). **Pass.**
