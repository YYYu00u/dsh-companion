# Delivery design

The difference between "a chatbot" and "someone in the room" is mostly timing. This layer is small, but it is where most of the felt realism lives.

## Inbound: debounce

The user types three short lines:

```
在吗
今天好累
不想动
```

A raw implementation sends three prompts and gets three unrelated answers. `delivery.in` waits for a quiet gap (`QUIET_MS = 3000`) with a hard ceiling (`MAX_WAIT_MS = 8000`), then joins them with newlines and sends one prompt. The ceiling matters: someone who keeps typing for a minute should not silence the companion indefinitely.

Images are held separately and attached to the same prompt. If the user sends an image with no text, the image is the message.

## Outbound: split and rhythm

Her reply:

```
又加班？
吃饭了没
（把“也行吧”咽回去）明天早点回
```

is split into bubbles:

1. By newline, `|||`, or a literal `\` (the persona prompt sometimes uses `\` as a separator).
2. Parenthesized stage directions become their own bubble, so they render in italic instead of inside a speech bubble.
3. `[表情:name]` becomes its own sticker bubble if the sticker exists; if it does not, that line is dropped rather than shown as raw text.
4. At most 6 bubbles; the tail is merged into the last one.

The first bubble is delivered immediately. Each subsequent bubble waits:

```
gap = min(4000, 600 + 900 × random + 150 × characters)
```

That produces roughly 0.6–1.5 seconds for a short line, longer for a long one, capped at 4 seconds. It is not a fake typing animation; it is the pace of someone typing a thought in pieces.

## Interruption

If the user speaks while bubbles are still queued, `interrupt()` clears the queue and records how many parts were actually sent in `.data/unsent.json`. The next prompt to her includes a note:

> 你上一条后面这几句还没发出去他就说话了，他没看到：「…」，还想说就再说，不想说就算了。

This is better than silently dropping the rest or pretending she said it. On refresh, `/api/history` hides the unsent parts so the transcript matches what the user saw.

## The occasional typo

With a 4% chance, a non-sticker bubble with at least 4 characters gets one common pinyin-input substitution (`的/得`, `在/再`, `吗/嘛`, …), followed 0.8–1.5 seconds later by a `*correct` line. It is a small humanity signal, not a comedy bit. It is disabled for parenthesized stage directions and stickers.

The typo map is intentionally tiny and Chinese-specific. For other languages, set `typoChance` to 0 or replace the map.

## Stickers

`[表情:name]` is a protocol, not an image upload:

- The model emits a line with the sticker name.
- `partOf()` checks the sticker index. Unknown names are dropped, so a hallucinated sticker never becomes a broken image.
- The web layer sends the bubble with `sticker: name`; the UI requests `/api/sticker/<name>`.
- `noteSent()` records what was sent and the preceding user line. When the user replies, `judgeSent()` records whether the reaction was fast/positive, which feeds the lesson statistics.

## Why not stream token-by-token into the bubble?

DSH already streams tokens, but showing a half-written sentence and then replacing it with a different split is worse than waiting. The delivery layer receives a completed message and decides how a person would have sent it. The UI shows "对方正在输入" during the turn, then pops bubbles at the chosen rhythm.

## Failure behavior

- A failed turn produces `idle` with the reason; the UI shows "她没说完（…）" instead of a stuck typing indicator.
- If the provider dies mid-stream, no partial bubble is emitted (the assistant message event never completes).
- If the browser disconnects, the SSE client reconnects; the transcript is rebuilt from `/api/history`.
- The delivery queue is in-memory. A restart loses unsent bubbles but not the stored message; a refresh shows the full reply.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `QUIET_MS` | 3000 | How long the user must pause before their messages are joined |
| `MAX_WAIT_MS` | 8000 | Hard ceiling on the debounce |
| max bubbles | 6 | Longer replies collapse into the last bubble |
| `TYPO_CHANCE` | 0.04 | 0 disables the typo behavior |
| gap | 0.6–4 s | Typing rhythm |

These are constants, not config, on purpose: they are part of the character's feel. Forks that want a different rhythm can change them in one file.
