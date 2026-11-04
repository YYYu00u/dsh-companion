# @dsh-companion/ears

Push-to-talk listening for the companion: system audio, microphone, or an audio file → text.

## Status

- **Capture is verified** on macOS 15.1 / Apple M2: a 5-second system-audio WAV and a 3-second microphone WAV were recorded and checked with `ffprobe` / `volumedetect`.
- **STT adapters are written but not verified with the real model here**: the default is `sherpa` (sherpa-onnx + SenseVoiceSmall); `local` (whisper.cpp) and `assemblyai` are optional. The build environment could not download the model, so the first run will fail with a clear message until you install it.
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

3. Install this bundle in DSH, and point `helper` at the binary and `stt.model` at the model:

   ```yaml
   helper: ~/.dsh-companion/bin/EarsCapture.app/Contents/MacOS/ears-capture
   stt:
     provider: sherpa
     sherpa:
       model: ~/.dsh-companion/models/sensevoice/model.int8.onnx
       tokens: ~/.dsh-companion/models/sensevoice/tokens.txt
       threads: 2
   ```

4. Restart DSH. Grant **Screen & System Audio Recording** and/or **Microphone** when prompted.

## Tools

- `listen_now({seconds, source})` — record 1–30 s and return a transcript. `source` is `system` or `mic`.
- `listen_file({path|url})` — transcribe a local audio/video file or a public http(s) URL.

Both return a short text block, never raw audio. The plugin does not listen on its own.

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

## License / attribution

Our code is MIT. The capture helper is independent Objective-C, but its design was informed by `insidegui/AudioCap` (BSD-2) and Apple's ScreenCaptureKit docs; see [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) and [LICENSES/BSD-2-Clause-AudioCap.txt](../../LICENSES/BSD-2-Clause-AudioCap.txt).

`sherpa-onnx-node` is Apache-2.0 and SenseVoice is MIT; both remain external dependencies. No model or binary is vendored.
