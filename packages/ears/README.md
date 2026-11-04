# @dsh-companion/ears

Push-to-talk listening for the companion: system audio, microphone, or an audio file → text.

## Status

- **Capture is verified** on macOS 15.1 / Apple M2: system-audio and microphone WAVs were recorded and checked with `ffprobe` / `volumedetect`. The helper now closes the WAV file before exiting, so the data chunk has a valid size.
- **STT is verified with the real model** on macOS 15.1 / M2: a 4.2-second system-audio clip was transcribed in about 0.9 s (`sherpa-onnx` + SenseVoice int8), and `listen_now` end-to-end took 5.7 s including the 4 s capture. The model is not committed; install it with the steps below.
- `local` (whisper.cpp) and `assemblyai` remain optional providers.
- ShazamKit song ID and the web voice-message UI are not in this package yet; see [docs/plans/ears.md](../../docs/plans/ears.md).

## Install

1. Build the capture helper:

   ```bash
   cd packages/ears/capture
   ./build.sh
   mkdir -p ~/.dsh-companion/bin
   cp -R EarsCapture.app ~/.dsh-companion/bin/
   ```

2. Install the ASR runtime and download a model. The default is sherpa-onnx + SenseVoiceSmall:

   ```bash
   cd packages/ears
   npm install          # installs sherpa-onnx-node (optional dependency)
   # download:
   # https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models
   # sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2
   # keep model.int8.onnx + tokens.txt (~250 MB), drop test wavs / float model
   ```

   The tarball is about 1 GB because it also contains the float32 model and test audio; keep only the int8 model.
   `whisper.cpp` is still supported via `stt.provider: local`.

3. Install this bundle in DSH. The top-level bundle gives you the pet menu and `/ears/api/*`; it does **not** add `listen_now` to the model tools by itself. To also give her the tools, add a preset row with the same package and config.
4. Point `helper` at the binary and `stt.sherpa.*` at the model:

   ```yaml
   helper: ~/.dsh-companion/bin/EarsCapture.app/Contents/MacOS/ears-capture
   stt:
     provider: sherpa
     sherpa:
       model: ~/.dsh-companion/models/sensevoice/model.int8.onnx
       tokens: ~/.dsh-companion/models/sensevoice/tokens.txt
       threads: 2
   ```

5. Restart DSH. Grant **Screen & System Audio Recording** and/or **Microphone** when prompted.

## Tools

- `listen_now({seconds, source})` — record 1–30 s and return a transcript. `source` is `system` or `mic`.
- `listen_file({path|url})` — transcribe a local audio/video file or a public http(s) URL.

Both return a short text block, never raw audio. The plugin does not listen on its own.

## Pet menu and HTTP

When `webServer` is available, the plugin registers:

- `GET /ears/api/status` — whether the helper and SenseVoice model exist.
- `POST /ears/api/listen` — `{seconds, source}` → `{ok, text, seconds, source}`; same-origin only.
- A desktop-pet menu item (default `听我 5 秒`, owner `大肥鱼·耳朵`). Clicking it records system audio, sends the transcript to that pet's own `/chat`, and the pet answers in its bubble. Set `menu: false` if you do not have `dsh-pet`.

The web listen button uses the same HTTP endpoint and puts the transcript into the composer instead of sending it automatically.

## Config

| Key | Default | Meaning |
|---|---|---|
| `home` | `~/.dsh-companion` | Reserved for future storage of transcripts/song history. |
| `helper` | `~/.dsh-companion/bin/ears-capture` | Built helper binary. |
| `stt.provider` | `sherpa` | `sherpa` (SenseVoiceSmall), `local` (whisper.cpp), or `assemblyai`. |
| `stt.binary` | `whisper-cli` | whisper.cpp CLI. |
| `stt.model` | none | whisper.cpp ggml path; required for `local`. |
| `stt.sherpa.model` / `.tokens` | none | SenseVoiceSmall int8 model + tokens.txt; required for `sherpa`. |
| `stt.sherpa.threads` | `2` | CPU threads for the worker. |
| `stt.language` | `zh` | Language hint. |
| `capture.maxSeconds` | `30` | Hard cap. |
| `capture.defaultSource` | `system` | Default source when the tool omits it. |
| `menu` | `true` | Register the desktop-pet menu item. |
| `menuLabel` | `听我 5 秒` | Menu label. |
| `menuSeconds` | `5` | How long the pet listens. |
| `menuSource` | `system` | `system` or `mic`. |

## License / attribution

Our code is MIT. The capture helper is independent Objective-C, but its design was informed by `insidegui/AudioCap` (BSD-2) and Apple's ScreenCaptureKit docs; see [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) and [LICENSES/BSD-2-Clause-AudioCap.txt](../../LICENSES/BSD-2-Clause-AudioCap.txt).

`sherpa-onnx-node` is Apache-2.0 and SenseVoice is MIT; both remain external dependencies. No model or binary is vendored.
