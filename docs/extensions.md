# 扩展（按需下载）

**基础装完就能聊。** 下面这些都不装也行，装了才多一项能力；任何一个坏了、缺模型、没装，基础功能必须照常跑（语音起不来就是没声音，耳朵不在就没按钮）。

## 基础（不算扩展）

| 包 | 做什么 |
|---|---|
| [`@dsh-companion/core`](../packages/core) | 人设、本子、心情、经历记忆、表情包、身体 |
| [`@dsh-companion/web`](../packages/web) | 网页房间、SSE、日记、中英切换 |

## 扩展

| 扩展 | 多出什么能力 | 额外要下什么 | 不装会怎样 |
|---|---|---|---|
| [`@dsh-companion/window`](../packages/window) | 像 QQ 的独立聊天窗 | 无（Electron 用 DSH 自带的） | 只在网页里聊 |
| [`@dsh-companion/web-search-bing`](../packages/web-search-bing) | 换掉 `web_search` 的实现，不用 API key | 无 | 用 DSH 默认的搜索 |
| [`@dsh-companion/voice`](../packages/voice) | 她能用本地音色说话，网页里点「▶ 语音」；自带选品页 `/companion-voice/` | **197 MB 模型**（`npm run models`）+ 参考音频（`npm run refs`，要自己的豆包 key） | 只有文字和表情包 |
| [`@dsh-companion/ears`](../packages/ears) | 按一下听系统声音/麦克风/文件，转成文字 | **ASR 模型**（SenseVoice int8）+ macOS 采集 helper | 她听不到声音 |
| [extras/chrome](../extras/chrome) | 她能开浏览器：点、填、截图（别人的 MCP，我们只给配置） | `chrome-devtools-mcp` 和 Chrome 扩展 | 没有 `mcp__chrome__*` 工具 |

## 装扩展的两条规矩

1. **模型不进仓库**：voice 197 MB、ears 的 ASR 模型都靠脚本下载，带 sha256 校验；仓库里只有代码和清单。
2. **降级要静音、不要报错**：扩展起不来只写日志，不打断聊天，不弹红色报错。

## 体积速查

| | 代码 | 模型 / 数据 |
|---|---|---|
| core + web | 几百 KB | 无 |
| window | ~50 KB | 无 |
| bing | ~20 KB | 无 |
| voice | ~100 KB | 197 MB + 参考音频 6~11 MB |
| ears | ~100 KB | SenseVoice 模型（几十 MB）+ helper |
| chrome | 示例配置 | 别人的 MCP 包 |

## 清单文件

上面这些不是靠文档维护的，靠根目录的 [`extensions.json`](../extensions.json)：

```bash
npm run extensions     # 列出扩展，以及本机的包和模型在不在
node scripts/extensions.mjs check   # 只校验清单（CI 也会跑）
```

每条记着：包名、路径、状态（verified / beta / external）、一句话用途、要下什么（URL、大小、sha256）。
`voice` 的两个模型连**解压后文件的 sha256**都钉住了，下载脚本按它校验。

加新扩展就是往清单里加一条；`npm test` 会检查 id 不重复、路径存在、包名和 `package.json` 对得上、sha256 格式对。
