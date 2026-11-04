# Third-party notices

Our code is MIT (see [LICENSE](LICENSE)). The "ears" feature is planned to borrow a small amount of permissively licensed code; this file records what comes from where, so the repository stays honest even before the first line of borrowed code lands.

## Planned / referenced components

| Component | License | Used for | How it is used |
|---|---|---|---|
| [insidegui/AudioCap](https://github.com/insidegui/AudioCap) | BSD-2-Clause | Reference for macOS system-audio capture | The shipped helper is independent Objective-C using ScreenCaptureKit; no AudioCap code was copied. The license text is kept in [LICENSES/BSD-2-Clause-AudioCap.txt](LICENSES/BSD-2-Clause-AudioCap.txt) for the reference. |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT | Local speech-to-text | External CLI/library; not vendored |
| [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 | Local ASR runtime (`sherpa-onnx-node`) | External npm dependency; not vendored |
| [QwenAudio/SenseVoice](https://github.com/QwenAudio/SenseVoice) | MIT | Chinese short-audio ASR (SenseVoiceSmall) | External model; not vendored |
| [pyannote/pyannote-audio](https://github.com/pyannote/pyannote-audio) | MIT | Speaker diarization (later phase) | External dependency; not vendored |
| [ShazamKit](https://developer.apple.com/documentation/shazamkit) | Apple system framework | Song identification | System framework, no code copied |
| [FFmpeg](https://ffmpeg.org/) | LGPL-2.1+ or GPL (build-dependent) | Decode/convert audio | External CLI; the repo does not redistribute binaries |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense | Download audio from public/authorized links | External CLI; optional |
| [screenpipe](https://github.com/screenpipe/screenpipe) | Commercial (see repository) | Architecture study only | **No code copied** |
| [SongRec](https://github.com/marin-m/SongRec) | GPL-3.0 | Behavior reference only | **No code copied or linked** |

## Rules

- Do not copy code from a commercial-licensed or GPL/AGPL project. Study the behavior, then implement it independently.
- Every adapted file gets an SPDX header and a comment naming the source repository and copyright holder.
- Do not vendor model weights or binaries whose license is unclear. Link to the upstream project and let the user install it.
- If a dependency's license changes, update this file before shipping.
