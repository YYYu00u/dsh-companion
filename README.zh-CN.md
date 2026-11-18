<p align="right"><a href="README.md">English</a> | <strong>简体中文</strong></p>

<p align="center">
  <img src="packages/core/icon.svg" width="88" alt="">
</p>

<h1 align="center">dsh-companion</h1>

<p align="center"><strong>她记得的是你们的日子，不只是最近二十句。</strong></p>

<p align="center">跑在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 里的本地陪伴。<br>
人设、本子、心情、经历、日记——都是你电脑上的普通文件。</p>

<p align="center">
  <a href="https://github.com/YYYu00u/dsh-companion/actions/workflows/ci.yml"><img src="https://github.com/YYYu00u/dsh-companion/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f" alt="License: MIT"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-0.2.1--rc.5-5b6cff" alt="DeepSeek Harness"></a>
  <img src="https://img.shields.io/badge/status-beta-f0a020" alt="Beta">
</p>

![网页房间](docs/images/home.jpg)

<sub>中文界面，演示数据。右上角可切 English；右边是她的鱼缸，水色跟着心情变。</sub>

## 这是什么

大多数 AI 陪伴记得的是「最近 N 句」。上下文满了压成一段摘要，关系就变成“他们聊过一些事”。

这里做的是压缩之后还能留下来的东西：

- **本地优先**：人设、日记、记忆、表情包、状态都是你目录里的文件。没有账号、没有遥测、没有托管服务。
- **连续，而不是聪明**：原话先存档，压缩时写成一段段“经历”，每轮按相关度和遗忘曲线回忆。
- **和干活分开**：她是一个没有 shell、不改文件、不弹审批的 preset。要动手时，“手”在单独的子会话里跑。
- **模型自己选**：DSH 能路由的 provider 都行，陪伴模型和可选的裁判模型可以分开配。

## 五分钟跑起来

要求：DSH 桌面版 **0.2.1-rc.5** 或兼容版本、Node.js 20+、DSH 里已经配好模型。

```bash
git clone https://github.com/YYYu00u/dsh-companion.git
cd dsh-companion
node scripts/init-home.mjs --name 大肥鱼
```

这几步会在 `~/.dsh-companion/` 建好她的家：人设、本子、标准、状态、身体部位。

然后：

1. 打开 DSH 侧栏 **插件**，从本地路径安装 `packages/core`
2. 再装 `packages/web`——到这一步就能聊了
3. 重启 DSH
4. 新建会话，选 preset **大肥鱼**
5. 打开 <http://127.0.0.1:4318/companion/>

第一次聊之前，改两处：`persona.md` 最后那节「你们的开始」（你们怎么认识、她怎么叫你），和 `notebook.md` 里「主人给我的设定」。

装不上、端口冲突，看 [安装与排错](docs/install.md)。

## 她会做什么

- **记得**：你说“下周三面试有点烦”，周三晚上她会来问；面完收进“过去的事”，不再反复问。
- **有自己的日子**：到点提醒、自己找事做、很久没来会去找你、晚上写日记和反思。都在 [她有自己的日子](#她有自己的日子)。
- **会打字**：连发几条她会等你说完；回复拆成几个气泡；你插话她会停；偶尔打错一个字，下一条按心情补一句。
- **会说话（beta）**：本地音色，点一下才念，断网也能用。
- **能听（beta）**：按一下录 15 秒，转成文字再给她。

## 她怎么记住你

短期是聊天历史；历史满了会被压缩——大多数做法压成一段摘要，压完只剩“他们聊过一些事”。

这里改成：

| 层 | 存什么 | 什么时候用 |
|---|---|---|
| 短期 | 最近的聊天 | 每次说话，直到被压缩 |
| 中期 | 一段段“经历” | 压缩时自动写；每轮挑 2~3 段相关的放进背景 |
| 长期 | 本子、对你的了解、现在的她、她的标准 | 一直在系统提示里，不靠检索 |

所以一个月后你说“面试好烦”，她想起的是“上次你也说烦，后来面得挺顺”，而不是把聊天记录倒出来。

不上向量库的原因、公式和触发条件写在 [记忆设计](docs/zh-CN/memory.md)。

## 她的人设不是一段 prompt

| 文件 | 是什么 | 谁能改 |
|---|---|---|
| `persona.md` | 根：她是谁、怎么说话、边界在哪 | 你；她只能提议 |
| `self.md` | 现在的她：习惯、看法、对你的感觉 | 她自己 |
| `standard.md` | 她想成为什么样的人 | 她自己（晚上反思） |
| `owner.md` | 她对你的了解 | 她自己 |
| `notebook.md` | 一件件具体的事、约定、偏好 | 她 |

她会变，但不会变成另一个人：根要动，得你点头。

写人设的三条经验：

- 写**具体的脾气**，不写形容词清单。“嘴硬心软，被说中了先顶一句再找台阶”比“温柔可爱”有用。
- 写**她怎么说话**。“短句，一次说一件事，不列清单”会直接改变输出。
- **留白**。人设是根，不是设定集；具体的日子放进本子。

更多见 [人设设计](docs/zh-CN/persona.md)。

## 她有自己的日子

她不是只在被戳的时候才存在。

- **惦记**：到点来问你答应了的事。
- **自己的时间**：一段时间没说话，她可能去翻热榜、找表情包、发条说说，也可能发呆。
- **主动找你**：很久没来会来找你；连着几次没回，她就不找了。
- **晚上反思**：写日记、看今天哪里没做好、决定哪些做法留下。

都有上限：活跃度 0–4 档、23:00–08:00 免打扰、失败的一轮会把次数退回去。嫌吵就把 `modules` 改成 `[]`。

## 聊天的手感

细节在 [发送层设计](docs/design/delivery.md)，这里只讲感受：

- 你连发三条，她等你停下来，合成一句再回。
- 她一次说几句，拆成几个气泡，按字数隔开。
- 你插话，她没发完就不发了。
- 偶尔打错一个字，下一条补一句「是「就」啦」——语气跟着心情走。
- 表情包必须真的存在才发，不会出现裂图。

## 装什么

**基础两个装完就能聊**；下面是扩展，按需再加，不装不影响聊天。体积和依赖见 [扩展说明](docs/extensions.md)。

| 基础 | 做什么 |
|---|---|
| [`@dsh-companion/core`](packages/core) | 人设、本子、心情、记忆、表情包、身体 |
| [`@dsh-companion/web`](packages/web) | 网页房间、SSE、日记、中英切换 |

| 扩展 | 多出什么 | 要额外下什么 |
|---|---|---|
| [`@dsh-companion/window`](packages/window) | 像 QQ 的独立聊天窗 | 无 |
| [`@dsh-companion/web-search-bing`](packages/web-search-bing) | 不用 key 的必应搜索 | 无 |
| [`@dsh-companion/ears`](packages/ears) | 按一下听声音，转成文字 | ASR 模型 + 采集 helper |
| [`@dsh-companion/voice`](packages/voice) | 本地音色，点「▶ 语音」才念 | 197 MB 模型 + 参考音频 |
| [extras/chrome](extras/chrome) | 她能开浏览器（别人的 MCP） | MCP 包 + Chrome 扩展 |

**硬规矩**：任何扩展不在或起不来，基础功能必须照常跑——语音没声音、耳朵没按钮，但聊天不能坏。

## 最近加了什么

0.3.x 都在磨「她像不像一个正在打字的人」：错字按心情补、连发先等、能看到她在想、能出声、同一张图换个名字存会被认出来。

逐版记录在 [CHANGELOG](CHANGELOG.md)，每个版本的说明在 [docs/releases](docs/releases/)。

## 已知限制

- **beta**：语音每句要等 15~60 秒；耳朵的采集只验过 macOS，识歌和网页语音还没做。
- **只在 macOS 上验过**；Windows/Linux 没试。
- **不打包她的真实数据**：人设、日记、记忆、表情包都不在仓库里，仓库里是一份原创示例。
- 旧的 DSH 内聊天 tab 已弃用，不再维护。

## 文档

- [安装与排错](docs/install.md) · [扩展说明](docs/extensions.md) · [验证记录](docs/verification.md)
- 设计：[记忆](docs/design/memory.md) · [发送层](docs/design/delivery.md) · [主动生活](docs/design/proactive.md) · [人设](docs/zh-CN/persona.md)

## 隐私

唯一的出站流量是模型请求，以及她主动去访问的网站。没有遥测。细节见 [SECURITY.md](SECURITY.md)。

## 许可

MIT。第三方组件和模型许可见 [NOTICE](NOTICE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
