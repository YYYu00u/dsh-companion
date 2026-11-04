# 耳朵：让大肥鱼听见音乐、视频和语音

状态：阶段 0 已开工并跑通采集；转写待装模型。目标是把“听”做成一个可选插件，不是把整个人的注意力一直挂在麦克风上。

## 0. 当前进展（2026-11-04）

- `packages/ears/capture/` 的 Objective-C helper 已编译通过，在本机 macOS 15.1 / M2 上抓到 **5 秒系统声音**和 **3 秒麦克风**；`ffprobe` 时长正确，`volumedetect` 最大 -2.7 dB，不是静音。
- 采集没有用原计划的 CoreAudio process tap，而是 ScreenCaptureKit：本机 Command Line Tools 的 Swift 编译器和 SDK 版本对不上，Swift 编不了；Objective-C 能编，且 macOS 15 上可用。代价是要“屏幕与系统音频录制”权限，不是纯音频权限。后续可加 CoreAudio tap 后端，CLI 参数不变。
- 转写代码（sherpa-onnx + SenseVoice、whisper.cpp CLI、AssemblyAI）已写，但本机没有 SenseVoice 模型，网络下载被重置，**没有端到端验过**。第一次跑会明确报“找不到模型/找不到 sherpa-onnx-node”。
- 网页语音上传、ShazamKit 识歌还没做。

## 1. 这一版做什么

第一版只做三件事：

1. **听一段系统声音**：你按一下，她听 15–30 秒你电脑里正在放的音乐/视频，转成文字；能识歌就带歌名。
2. **听你发的语音/音频**：网页里发一条语音或音频文件，她转成文字后接话。
3. **听你说话**：按一下麦克风，录 15 秒，转文字。

不做：

- 全天常听、后台一直录
- 声纹识别“这是谁”
- 本地 7B 音频大模型（M2 8GB 跑不动）
- 自动下载付费/登录/DRM 视频
- 未经同意克隆别人的声音

## 2. 用户看到的样子

网页输入框旁边多两个按钮：

- 🎙 **听我说 15 秒**：按一下开始，再按一下停；转写结果作为“你刚才说的”进她的上下文。
- 🎧 **听现在 15 秒**：抓系统声音；如果是歌，显示“《歌名》— 歌手”，再把歌词/氛围摘要给她。
- 发音频文件：和发图一样，先挂在输入框上方，发送后转写，再交给她。

她收到的是这样的工具结果：

```text
你刚才听到（系统声音，15 秒）：
[音乐] 正在放《晴天》— 周杰伦。你只听了 15 秒，没听全。
[人声] “……从前从前有个人爱你很久……”
```

原始音频默认不留在磁盘；要留就只留 7 天，并且能在网页上一键删。

## 3. 架构

```mermaid
flowchart LR
  U[网页 / 聊天窗] -->|按一下| E[@dsh-companion/ears]
  E -->|spawn| H[ears-helper<br/>Swift + CoreAudio tap]
  H -->|16k mono wav| E
  E -->|VAD / 切段| S[sherpa-onnx / SenseVoice]
  E -->|12s 音频| Z[ShazamKit]
  S -->|文字| E
  Z -->|歌名/歌手| E
  E -->|工具结果| C[core preset]
  C -->|接话| U
  H -->|麦克风| E
  F[音频文件/链接] -->|ffmpeg / yt-dlp| E
```

### 采集：ScreenCaptureKit（第一版）/ CoreAudio tap（后续）

第一版用 ScreenCaptureKit：macOS 13+，能抓系统声音，Objective-C 可以直接编；需要“屏幕与系统音频录制”权限。helper 的 CLI 是 `--source system|mic --seconds N --out file.wav`。

原计划是 CoreAudio process tap（macOS 14.4+，只要“音频录制”权限，不要屏幕录制），参考 `insidegui/AudioCap`（BSD-2）。本机 Swift 编译器/SDK 不匹配，Swift 编不过，所以先用 Objective-C + ScreenCaptureKit 把闭环跑通；后续再加一个 CoreAudio tap 后端，不动上层工具接口。

- 系统声音：`CATapDescription` + `AudioHardwareCreateProcessTap`，输出 16 kHz 单声道 PCM。
- 麦克风：`AVAudioEngine`，同样 16 kHz 单声道。
- 文件：`ffmpeg -i input -ar 16000 -ac 1 -f wav`。
- 链接：`yt-dlp -x --audio-format wav` 后交给 ffmpeg；只做公开/有权的内容。

### 转写：本地优先

- 默认 `sherpa-onnx` + `SenseVoiceSmall`（Apache-2.0 运行时 / MIT 模型）：中文/粤语/英/日/韩，带标点和情绪/事件标签；模型 int8 约 250 MB，CPU 1–2 线程。
- `whisper.cpp` 保留为 `stt.provider: local` 的备选；大模型不推荐，资源占用高。
- 云端可选 AssemblyAI / Deepgram，配置里换 provider；默认不联网。
- VAD：先做能量阈值 + 静音切段；后面再换 Silero VAD。

### 识歌：ShazamKit

- 系统框架，免费，不额外申请 key。
- 12 秒左右的音频 buffer 交给 `SHSession`，返回歌名、歌手、封面。
- 没识别出来就明确说“没听出来”，不猜。
- 歌词/歌曲信息再从网页查；不要用 GPL 的 SongRec 代码。

### 音频理解（第二阶段）

第一版只做“文字 + 歌名”。要描述“乐器、情绪、音色”时，再选：

- 云端音频模型：Gemini / Qwen-Omni / Kimi-Audio 的 API，按 10 秒片段调用；
- 本地：Qwen2-Audio 7B，16GB 内存起步，M2 8GB 不建议。

## 4. 插件接口

新包：`@dsh-companion/ears`（Host 级）。

工具：

| 工具 | 参数 | 返回 |
|---|---|---|
| `listen_now` | `seconds=15`, `source=system\|mic` | `{text, song?, segments?, capturedAt}` |
| `listen_file` | `path` 或 `url`, `language?` | 同上 |
| `what_song` | `seconds=12` | `{title, artist, artwork?, confidence}` |
| `stop_listening` | — | `{stopped}` |

服务（给网页用）：

```js
ctx.get('ears').transcribe(buffer, { mime, source: 'voice' })
```

配置：

```yaml
- id: dsh-companion-ears
  name: '@dsh-companion/ears'
  config:
    home: ~/.dsh-companion
    helper: ~/.dsh-companion/bin/EarsCapture.app/Contents/MacOS/ears-capture
    stt:
      provider: local        # local | assemblyai | deepgram
      model: large-v3-turbo
      language: zh
    capture:
      maxSeconds: 30
      defaultSource: system # system | mic
    song:
      enabled: true          # ShazamKit
    storage:
      keepAudioDays: 0       # 0 = 不落盘
```

数据：

- `.data/ears/transcripts.jsonl`：每次听了什么、多长、转写、歌名；不进 git。
- `.data/ears/audio/`：仅当 `keepAudioDays > 0`；默认不建。
- `.data/ears/songs.jsonl`：识歌历史，方便以后做“你最近在听什么”。

## 5. 网页改动

- 输入框旁加麦克风 + 耳机按钮；录音时有明显红点/计时。
- 接受 `audio/*` 上传，大小上限 20 MB；先转 16k wav 再转写。
- 转写结果做成一张“她听到了”的小卡片，和她的回复分开，不冒充她说的话。
- 权限被拒时给出人话：“系统设置 → 隐私与安全性 → 音频录制，把 DSH/终端打开”。
- 默认不自动发送“听”的结果；你确认“发给她”才进对话。

### Apple Speech 试过（2026-11-04）

- `SFSpeechRecognizer` 能编译，`zh-CN` locale 也能创建；`SFSpeechURLRecognitionRequest` + `requiresOnDeviceRecognition` 的代码已写。
- 直接跑 CLI 和临时 `.app` 都在 `SFSpeechRecognizer requestAuthorization` 处 `SIGABRT`；崩溃报告明确写 TCC 认为缺少 `NSSpeechRecognitionUsageDescription`，但 Info.plist 和代码签名里都有这个键。
- `tccutil reset SpeechRecognition` 在当前沙箱里 `Operation not permitted`，`open` 启动临时 app 也不稳定。判断是 ad-hoc 签名/LaunchServices/TCC 缓存的环境问题，不是 API 不存在。
- 结论：**不把 Apple Speech 作为第一版 provider**；它需要用户从 Finder 启动一个正式签名的 app、手动授权一次，才能在别人的机器上稳定。先走 sherpa-onnx，不碰 TCC。

## 6. 借用和许可

| 项目 | 许可 | 借什么 | 怎么标 |
|---|---|---|---|
| [AudioCap](https://github.com/insidegui/AudioCap) | BSD-2-Clause | CoreAudio process tap 的采集和权限处理（架构参考） | 第一版用独立 ObjC + ScreenCaptureKit，没有复制 AudioCap 代码；许可证文本仍保留 |
| [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 | 本地转写运行时（`sherpa-onnx-node`） | 外部依赖，不 vendor；README/NOTICE 标 |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT | 本地转写备选 | 外部依赖，不 vendor；README/NOTICE 标 |
| [SenseVoice](https://github.com/QwenAudio/SenseVoice) | MIT | 中文短语音转写（可选） | 外部模型/运行时；标来源和模型许可 |
| [pyannote-audio](https://github.com/pyannote/pyannote-audio) | MIT | 以后做说话人分离 | 第二阶段再引 |
| ShazamKit | Apple 系统框架 | 识歌 | 系统框架，不复制代码 |
| ffmpeg | LGPL/GPL（看构建） | 解码/转码 | 外部 CLI，不随仓库分发二进制 |
| yt-dlp | Unlicense | 下载公开视频音频 | 外部 CLI，可选 |
| [screenpipe](https://github.com/screenpipe/screenpipe) | **商业许可** | 只看架构，不复制代码 | 在 NOTICE 里注明“未使用代码” |
| [SongRec](https://github.com/marin-m/SongRec) | **GPL-3.0** | 只看行为，不复制 | 同上 |

原则：

- 我们的代码 MIT；借来的 BSD-2 文件保留 BSD-2 头，整体仓库在 `THIRD_PARTY_NOTICES.md` 里说明混合许可。
- 不把商业许可/GPL 代码抄进来；GPL 项目最多作为“行为参考”，不链接、不复制。
- 每个借用的文件头写：

```swift
// SPDX-License-Identifier: BSD-2-Clause
// Adapted from insidegui/AudioCap (https://github.com/insidegui/AudioCap)
// Copyright (c) 2024 Guilherme Rambo
```

## 7. 分阶段计划

| 阶段 | 交付 | 时间 | 验收 |
|---|---|---|---|
| 0 | 采集 helper 抓 15 秒系统声音，落 wav，能播放 | 0.5–1 天 | 放一首歌，wav 有声音；权限拒绝时不崩（**已完成**：5s 系统声音 + 3s 麦克风） |
| 1 | sherpa-onnx + SenseVoice 转写，`listen_now` 工具，结果进她上下文 | 2–3 天 | 说一句话，5 秒内出文字；音乐段不乱转 |
| 2 | 语音/音频上传，网页“听到了”卡片 | 1–2 天 | 发一条微信语音，她接得上话 |
| 3 | ShazamKit 识歌 + 歌名卡片 | 1–2 天 | 放《晴天》能出歌名；没听出来明确说 |
| 4 | 文档、NOTICE、测试、截图、发版 | 1–2 天 | `npm test` / `npm run check` 绿；CI 过 |

总计约 **7–10 个工作日**；先做 0–1，能听再谈识歌和音色。

## 8. 验收样本（故意用脏的）

- 有人声的歌（周杰伦/英文歌各一）
- B 站视频，背景有音乐 + 说话
- 微信语音 5 秒、30 秒各一条
- 嘈杂房间/风扇声
- 纯音乐、无人声
- 静音 15 秒
- 权限拒绝、设备切换（耳机/外放）

通过标准：

- 有人声时转写可读；纯音乐不乱编歌词。
- 识歌 10 秒内返回；不认识就说不知道。
- 不把 15 分钟的视频整段塞进上下文。
- 不落盘时 `.data/ears/audio` 为空。
- 权限被拒有明确提示，不崩。

## 9. 风险

| 风险 | 处理 |
|---|---|
| TCC 音频录制权限绑定 app/binary，CLI 可能反复弹窗 | helper 打成最小 `.app`，签名稳定；CLI 只做开发模式 |
| CoreAudio tap 在 macOS 14.4 以下不可用 | 启动时检查版本，给出明确错误；不假装能听 |
| 音乐被 SenseVoice 转成奇怪歌词 | 先做音乐/人声分类；音乐段只识歌，不转写 |
| 云端 STT 隐私/账单 | 默认本地；云 provider 必须显式配置；VAD 过滤静音 |
| 长音频把上下文撑爆 | 只回摘要/片段，原文字数上限；完整转写落文件 |
| 许可污染 | 只借 BSD/MIT/Apache；GPL/商业项目只做参考，不复制 |

## 10. 第一版不做

- 全天监听
- 声纹识别“这是谁”
- 声音克隆
- 本地 7B 音频模型
- 自动绕过登录/DRM/付费墙
- 把原始音频发给聊天模型

## 11. 下一步

阶段 0 已完成。下一步是阶段 1：装 sherpa-onnx-node + SenseVoice 模型，跑 `listen_file` 转写；再把 `listen_now` 接进她的工具列表。
