# 本地嗓子（voice）

给陪伴角色一个**离线**的声音：挑好的音色 + 本地零样本克隆，网页里点一下才出声。

## 它由三块组成

| 块 | 在哪 | 进包吗 |
|---|---|---|
| 引擎 | `runtime/tts-server.py` + `src/engine.js` | ✅ |
| 清单 | `assets/voices.json`（音色 id + 参考文本） | ✅ |
| 参考音频 | `assets/*.wav`，`npm run refs` 生成 | ❌ 自己生成 |
| 模型 | `.models/`，`npm run models` 下载 | ❌ 197 MB |

## 为什么参考音频不随包

那几段是**豆包合成的音频**，音色是平台的东西；把它当资产再分发有条款风险，体积也不小。
随包的是「用哪个音色 + 念什么」，使用者填自己的 key 跑一次 `npm run refs` 就有了。

参考文本必须和音频**一字不差**——克隆是拿文本和音频对齐的，改一个字都会念错。

## 两步准备

```bash
npm run models                 # 下载 ZipVoice int8（约 197 MB）+ 声码器，校验 sha256
VOLC_KEY=xxx npm run refs      # 用你的豆包 key 生成 10 段参考音频（需要 ffmpeg）
```

Python 依赖：`pip install -r runtime/requirements.txt`（或建 `.venv` 让引擎自己找到）。

## 一次合成要多久

M 系列 Mac、纯 CPU、20~28 秒参考：

| 步数 | 1.3 秒的话 | 7 秒的话 |
|---|---|---|
| 8（默认，质量优先） | 15 秒 | 59 秒 |
| 4 | 8.5 秒 | 34 秒 |
| 2 | ~4 秒 | 12 秒 |

参考越长越慢，而且是**超线性**：33 秒参考比 11 秒慢约 3 倍。这就是为什么默认参考 20~30 秒、不再加长。
线程数 8 比 4 更慢，别加。

## 网页怎么用

插件自己把接口挂在 DSH 上（不用网页插件配合）：

- `GET  /companion-voice/` 选品页：十个音色点着听，点「用这个」写进 `voice.json`
- `GET  /companion-voice/api/voices` 清单 + 当前默认
- `GET  /companion-voice/api/voice/<id>` 参考音频（wav）
- `POST /companion-voice/api/say {text}` → wav
- `POST /companion-voice/api/voices/default {id}` 换默认

网页房间里的「▶ 语音」还是走它自己的 `/api/say`（部署侧的实现），两条路最后都到同一个本地服务。
- 前端：她那条话以 `[语音]` 开头时剥掉标记，气泡后面放一个「▶ 语音」
- 点之前 1.2 秒先后台合成（防抖，只合成最后一条）；点的时候有缓存就直接播
- 结果按 `voice|text` 缓存，同一句第二次秒开

## 常见问题

**服务起不来**：先看 `.models/` 和 `assets/*.wav` 在不在；`python runtime/tts-server.py` 手动跑一遍看报错。

**1.0 音色调不了**：参考音频用的豆包套餐端点（`/api/v3/plan/tts/unidirectional`），只认 2.0 音色；1.0（如湾湾小何）会 403。

**想换音色**：改 `assets/voices.json` 换 id，跑 `npm run refs` 生成新参考，再重启。不用重训。
