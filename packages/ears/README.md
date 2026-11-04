# @dsh-companion/ears

Push-to-talk listening for the companion: system audio, microphone, or an audio file → text.

## Status

- **Capture is verified** on macOS 15.1 / Apple M2: a 5-second system-audio WAV and a 3-second microphone WAV were recorded and checked with `ffprobe` / `volumedetect`.
- **STT is implemented but not verified end-to-end here**: it expects `whisper-cli` (whisper.cpp) plus a model file. The build environment could not download the model, so the first run will fail with a clear message until you install it.
- ShazamKit song ID and the web voice-message UI are not in this package yet; see [docs/plans/ears.md](../../docs/plans/ears.md).

## Install

1. Build the capture helper:

   ```bash
   cd packages/ears/capture
   ./build.sh
   mkdir -p ~/.dsh-companion/bin
   cp -R EarsCapture.app ~/.dsh-companion/bin/
   ```

2. Install `whisper.cpp` (for example via Homebrew or a source build) and download a model:

   ```bash
   # example only; use the build/install method you prefer
   whisper-cli --help
   # model: ggml-small.bin or ggml-large-v3-turbo-q5_0.bin
   ```

3. Install this bundle in DSH, and point `helper` at the binary and `stt.model` at the model:

   ```yaml
   helper: ~/.dsh-companion/bin/EarsCapture.app/Contents/MacOS/ears-capture
   stt:
     model: ~/.dsh-companion/models/ggml-small.bin
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
| `stt.provider` | `local` | `local` (whisper.cpp) or `assemblyai`. |
| `stt.binary` | `whisper-cli` | whisper.cpp CLI. |
| `stt.model` | none | Path to a ggml model; required for local. |
| `stt.language` | `zh` | Language hint. |
| `capture.maxSeconds` | `30` | Hard cap. |
| `capture.defaultSource` | `system` | Default source when the tool omits it. |

## License / attribution

Our code is MIT. The capture helper is independent Objective-C, but its design was informed by `insidegui/AudioCap` (BSD-2) and Apple's ScreenCaptureKit docs; see [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) and [LICENSES/BSD-2-Clause-AudioCap.txt](../../LICENSES/BSD-2-Clause-AudioCap.txt).

`whisper.cpp` is MIT and remains an external dependency; no model or binary is vendored.
