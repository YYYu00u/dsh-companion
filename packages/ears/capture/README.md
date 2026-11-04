# EarsCapture

A small Objective-C helper that records 1–30 seconds of system audio or the microphone to a WAV file.

## Build

```bash
cd packages/ears/capture
./build.sh
# -> ./EarsCapture.app/Contents/MacOS/ears-capture
```

Requires the macOS Command Line Tools (clang). No Xcode project, no third-party framework.

## Permissions

- System audio: **System Settings → Privacy & Security → Screen & System Audio Recording**. The first run prompts; allow the terminal/DSH app that launches the helper.
- Microphone: **Privacy & Security → Microphone**.

The permission is attached to the process that launches the helper. If you move the helper or run it from a different terminal, macOS may ask again.

## Test

```bash
# play something in another app, then:
./EarsCapture.app/Contents/MacOS/ears-capture --source system --seconds 5 --out /tmp/ears.wav
ffprobe -v error -show_entries format=duration -of default=nw=1 /tmp/ears.wav

# microphone:
./EarsCapture.app/Contents/MacOS/ears-capture --source mic --seconds 3 --out /tmp/mic.wav
```

The helper writes the native tap format (currently 16 kHz mono float). `packages/ears/capture.js` converts it to 16 kHz mono PCM16 for whisper.cpp.

## Implementation note

This uses **ScreenCaptureKit** because it compiles with the installed Command Line Tools and works on macOS 15. The original plan preferred CoreAudio process taps (which need only the audio-recording permission, not screen recording). A future version can add a CoreAudio-tap backend; the CLI contract (`--source`, `--seconds`, `--out`) stays the same.

Architecture informed by [insidegui/AudioCap](https://github.com/insidegui/AudioCap) (BSD-2) and Apple's ScreenCaptureKit documentation. The helper is an independent implementation; see [THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md).
