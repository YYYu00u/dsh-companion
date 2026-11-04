# Ears + voice: the cross-plugin contract

This note is for anyone wiring the senses together. Each piece can ship alone; this is what changes when they are used by the same companion.

## Pieces

| Piece | Package | Role |
|---|---|---|
| Ears | `@dsh-companion/ears` | Capture 15–30 s, transcribe with SenseVoice/whisper/AssemblyAI, expose `listen_now` / `listen_file` |
| Ears Host surface | same package | `GET /ears/api/status`, `POST /ears/api/listen`, optional pet menu |
| Voice | `@dsh-companion/voice` | Local ZipVoice TTS, `POST /tts`, reference voices |
| Host TTS | private web package | `/api/say`, TTS cache, voice messages |
| Window | `@dsh-companion/window` | Electron chat window; consumes the host API |

## Data flow

```text
pet menu ──▶ /ears/api/listen ──▶ capture ──▶ SenseVoice ──▶ transcript
                                                               │
                                                               ▼
                                                     pet /chat (bubble)

web/window microphone ──▶ POST /api/voice ──▶ save audio ──▶ transcribe
                                                               │
                                                               ▼
                                             message: [语音 v-xxxx 3.2] text
                                                               │
                                                               ▼
                                                  history + SSE row

her [语音] reply ──▶ deliver ──▶ voice.say ──▶ .data/tts-cache/<hash>.wav
                                      │                  │
                                      ▼                  ▼
                              .data/voice-in/v-xxxx.wav   voice-index.json
                                      │
                                      ▼
                         message: [语音 v-xxxx 3.2] transcript
```

## Contracts

### Ears

- `GET /ears/api/status` → `{ok, helper, model, seconds}`. The UI should hide its listen button unless `ok`.
- `POST /ears/api/listen` → `{ok, text, source, seconds}`. Same-origin only; body ≤ 4 KB; max 30 s.
- The pet menu owner is `大肥鱼·耳朵`, one label (default `听我 5 秒`). Clicking sends the transcript to `/dsh-pet-7340/chat?pet=<id>&surface=desktop`.

### Voice

- `POST /tts` → 24 kHz mono WAV. Text is capped by the caller; reference text must match the reference wav exactly.
- TTS cache key is `sha256(voiceId + "\0" + text)`; store under `<home>/.data/tts-cache/`.
- Voice-message marker: `[语音 v-<10 hex> <seconds>] <transcript>`. The marker is parsed by `withVoice`; the UI must never display the transcript by default.

### History

- `GET /api/history?limit=30` → recent page plus `hasMore` / `before`.
- `GET /api/history?limit=30&before=<oldest seq>` → older page. The client preserves scroll height when prepending.
- The client must hide the list until the first page is rendered at the bottom; otherwise the top-to-bottom jump is visible.

## Failure rules

- Ears helper/model missing: status shows `ok` false; buttons stay hidden; the chat still works.
- TTS fails: keep the original `[语音] text` message and let the click synthesize; never block the reply.
- Voice index missing for an old message: fall back to click-to-synthesize; do not rewrite history.
- History page fails: keep loaded rows and show an error; do not clear the list.

## Privacy

- No always-on capture. Every capture is a user action or an explicit pet-menu click.
- Audio defaults to `home/.data/voice-in/`; TTS cache is text-keyed and local.
- Do not commit reference wavs, models, `.venv`, or private homes. See `.gitignore`.

## Verification

- `npm test` (48 tests) covers WAV parsing, capture bounds, whisper args, plugin boot, pet menu, and history helpers.
- Manual: play a known 4 s clip → `/ears/api/listen` returns text; reopen a chat with a voice message → the bar shows the same seconds; scroll to the top → older page loads without a jump.
