# Proactive life

"Proactive" is easy to add and easy to make annoying. The design target is: **she has a day, but she does not chase you.**

## One tick, four modules

Every 60 seconds, `life.tick()` checks, in order:

1. **Remind** — a reminder whose time has passed, inside the allowed hours, under the daily budget.
2. **Reflect** — after `schedule.reflectAt` (default 22:30), once per day, only if the user talked today.
3. **Own time** — after 20 minutes of quiet and 30 minutes since the last own-time, roll a die (`1/60` per tick); if it hits and the budget allows, she goes and does something.
4. **Nudge** — if the user has been idle past an exponentially growing interval, and she has not been ignored 3 times in a row.

All four send a `（旁白）` message. The web plugin hides narration from the transcript. If she replies exactly `[沉默]`, nothing is delivered.

## Budgets come from the activity level

| Level | Name | Nudges/day | Own time/day | Exam | Senses |
|---|---|---|---|---|---|
| 0 | 只聊天 | 0 | 0 | no | no |
| 1 | 省着点 | 4 | 0 | no | yes |
| 2 | 平常 | 8 | 2 | yes* | yes |
| 3 | 活泼 | 16 | 4 | yes* | yes |
| 4 | 全开 | 16 | 6 | yes* | yes |

\* The exam still needs `config.exam.enabled` and a corpus; the level only says whether it is allowed.

The level is a single 0–4 value stored in `.data/level.json`. It is exposed as a slider in the web UI. Level changes affect the *background* behavior, not the chat itself: she always answers when spoken to.

## Randomness, not a schedule

Own time is not a cron job. Every tick rolls a die with a `1/60` chance, subject to two floors:

- the user has been quiet for at least 20 minutes (do not disappear mid-conversation);
- at least 30 minutes since the last own-time (do not do six things in a row).

When it fires, she gets one randomly weighted opening thought from a small list (boredom, a news item, a song, a new word, missing the user but not wanting to say it, wanting to post something, wanting to do nothing). The list is an opening, not a script; the prompt says she can ignore it.

## Quiet hours and away detection

- Default quiet hours are 23:00–08:00 (`schedule.quietStart/quietEnd`).
- If the machine is locked or idle for 5 minutes (`senses.away()`), she does not nudge. A reminder may be held for up to an hour; after that it is delivered anyway so it is waiting when the user returns.
- A message that fails to send is not counted. `onTurnEnd` rolls back the counter, re-arms the reminder, and schedules a retry in 10 minutes. This was a real bug in the reference deployment: a network outage burned the entire daily budget and she "gave up" without ever having spoken.

## Escalation and giving up

If the user does not answer a nudge, the next wait doubles (3h → 6h → 12h), with ±25% jitter, up to 12 hours. After 3 unanswered nudges she stops nudging and waits for the user. Her own time, diary, and reflection continue.

This is deliberately asymmetric: silence is a signal, but it should not make her punitive or spammy.

## Reflection

Once per day after the configured time, if the user talked that day:

1. Build the material: optional exam result, today's reactions, today's episodes, trial lessons, her standard, the user's raw lines.
2. Write it to `.data/mind/tonight.md` (not into the chat history).
3. Send a narration prompt with the tasks: diary, learn, judge lessons, grow, want_to, know_him, optionally browse, and end with `[沉默]`.
4. On turn end, delete the material file.

Keeping the material out of the transcript is important: otherwise every evening adds thousands of tokens that are replayed in every later request.

## What is not automated

- She does not send messages at night (23:00–08:00).
- She does not nudge while the user is actively typing/chatting (20-minute quiet floor).
- She does not nudge when the screen is locked.
- She does not run a fixed "morning greeting" or "goodnight" script; those would become predictable within a week.
- She does not spend money, post publicly, or contact third parties on her own. The hands prompt forbids it unless the task explicitly says so.

## Observability

`GET /api/mind` returns `life.snapshot()`: today's counts, limits, modules, and the next idle estimate. The web UI shows "今天主动找你 1/8 次，自己的时间 1/2 段". This is enough to debug "why didn't she message me?" without reading logs.

Failures are logged with `life tick failed` and the turn reason; the retry timestamp is stored in `life.json` so a restart does not immediately retry.
