# 记忆模块

下次改这里先看这份，不用重读代码。为什么这么设计、和开源方案怎么比，见 [docs/design/memory.md](../../../docs/design/memory.md)。

状态：参考实现里跑过一段时间；`store.js` 的切词、切段、检索、遗忘曲线有单元测试。经验数据来自真实使用，但也因此没有随仓库分发。

## 一句话

短期是聊天历史，中期是一段段经历，长期是本子、对他的了解、现在的她。压缩的时候短期变成中期；每轮用他刚说的话去中期里找相关的经历放进背景；经历会按遗忘曲线慢慢想不起来，原话永远留着能翻。

## 三层

| 层 | 是什么 | 存在哪 | 谁写 | 会不会忘 |
|---|---|---|---|---|
| 短期 | 聊天历史（DSH 会话里还看得到的那部分） | DSH 会话 | DSH | 到 2.4 万 token 压掉旧的，留最近 6000 |
| 中期 | 一段段经历 | `.data/memory/episodes.jsonl` | 压缩时自动写（compact.js） | 会，按遗忘曲线 |
| 长期 | 本子、对他的了解、现在的她、标准、做法 | `notebook.md` `owner.md` `self.md` `standard.md` `lessons.json` | 她自己用工具写，晚上反思时整理 | 不忘，每轮都在系统提示里 |
| 档案 | 原话，一句一行 | `.data/memory/turns.jsonl` | 边聊边记（chat.js） | 不删 |

`.data/` 不进 git。一个人（一个 home）一份。

## 文件

| 文件 | 做什么 |
|---|---|
| `store.js` | 记忆库：读写两个 jsonl；切段；二元字 BM25；遗忘曲线；打分；自动连边。同一个家只开一份（`openMemory` 有缓存），聊天侧和压缩侧共用 |
| `episodes.js` | 把几阵原话一次调用写成经历；模型挂了用规则写粗的（`rough: true`），保证压缩不失败 |
| `chat.js` | 挂在大脑插件里（`index.js` 调 `registerMemory`）：记原话、每轮想起来、`look_back` 工具 |
| `compact.js` | 压缩插件，preset 里写 `@dsh-companion/core/compact`。继承 DSH 的 `BasicCompactionEngine`，只重写 `summarize()` 和 `compactIfNeeded()`；另外挂了按天压和去掉思考 |
| `hostdeps.js` | 从 DSH 安装包（`app.asar` 里的 `dsh/node_modules/@deepseek-ai`）import 宿主的包。裸 import 找不到，因为我们的插件是 link 进 profile 的 |

## 数据格式

`turns.jsonl` 一行一句：

```json
{"id":"t3","at":1793370745027,"who":"他","text":"改了一天bug 明天下午三点还有个面试","key":"076497c1:29","msgId":"e12e…","pic":"s-…"}
```

- `key` = 会话 id 后 8 位 + 事件号，去重用（重启、补历史不会重复）
- `msgId` = DSH 消息 id，压缩时靠它认出被压掉的是哪几句
- 不存：旁白、背景快照、她的思考、工具调用、`[沉默]`

`episodes.jsonl` 一行一段。同一段改过（被想起次数变了）会再追加一行，读的时候按 `id` 取最后合并的：

```json
{"id":"e7","from":…,"to":…,"day":"2026-11-02","turnIds":["t40","t41",…],
 "title":"展馆排队","gist":"他说……我……","keywords":["展馆","排队","排一小时","展览"],
 "people":[],"his_mood":"松","her_mood":"开心","emotion":1,"importance":2,
 "open":["他说下次带我去"],"said":[],"new_terms":[],
 "links":[{"id":"e3","why":"他上次说去展览"}],"recalled":0,"lastRecalled":…}
```

另外两个辅助文件：`recalls.jsonl` 记每次想起了哪段、线索是什么（以后调参数用）；`checkpoints.jsonl` 记压缩检查点里列了哪几段，检查点再被压时带上它们，想起来时不重复拿。

## 流程

**记原话**（chat.js）：每一步开始（`agent/pre-step`）、拼背景时、一轮结束（`agent/turn-stopping`）都从上次记到的事件往后扫一遍会话，新的原话追加进档案。不用 `session/event`，因为插件在 preset 里，这个通知不一定收得到。

**压缩 → 写经历**（compact.js `summarize`）：
1. DSH 判断该压了（2.4 万 token），选好要压的那一段，交给 `summarize(input)`
2. 用 `input.messages` 里的消息 id 对上档案里的原话
3. 要写的 = 被压掉的 + 更早还没写过的（第一次用时会把以前的原话一起补成经历）
4. 按「隔 30 分钟 / 跨天（4 点）/ 满 40 句」切成几阵，一次最多 3 阵调一次模型（`episodeProvider` / `episodeModel`；不配就用当前会话的模型）
5. 写好的经历存进去，和最近 20 段比，模型说有关的连边，关键词或人有 2 个以上相同的也自动连边（双向）
6. 返回检查点文字：「下面是今天之前、或者今天早些时候你们聊过的……」+ 被压掉的那几段（3 天以内、最多 12 段）的一行经过

**按天压**（compact.js `_registerDaily`）：每一步开始前看聊天历史里有没有昨天（4 点分界）的原话；有、而且最近一句已经过去 30 分钟、而且那部分超过 3000 字，就把昨天那部分压掉。一个会话一天只试一次。

**压缩线**：DSH 的压缩只认窗口比例。`compactIfNeeded` 第一次见到一个模型时，用 `thresholdTokens / 窗口` 算出比例，塞进 `modelPolicies`。

**去掉思考**（compact.js `_registerStripReasoning`）：DSH 会把历史里她的思考按 `reasoning_content` 发回去。挂 `llm/stream`（global、prepend），只管 `agentPreset` 是自己 preset 的会话：最后一条「他说的 / 旁白」之前的 assistant 消息去掉思考块和 `replayState`，用改过的请求重新调一次 `ctx.llm.stream()`，自己在第二遍放行。agent loop 的标记跟着带过去。

**想起来**（chat.js `dsh-companion:memory`，order 320，每轮的快照里）：
1. 线索 = 他刚说的那句（`agent/pre-step` 的 `messages` 里拿，这时它还没进会话）
2. 太短、只是「嗯哈好」、是告别（`BYE_RE`），就不想
3. 排除眼前已经有的：原话还在聊天历史里的段、检查点里列着的段
4. 打分取前 3，相关度（归一）< 0.3 不要，记得的程度 < 0.05 不要；顺着连边多带 1 段
5. 被想起的段 `recalled + 1`、`lastRecalled = 现在`（10 分钟内重复不算）
6. 同一句线索、经历数没变，就用缓存，不重复算、不重复加次数

**look_back**：先按关键词找经历（不管忘没忘），给那段的原话（最多 30 句）；找不到经历就直接在原话里找。

## 公式（store.js）

```
相关度     = BM25(线索, 标题 + 经过 + 关键词×2 + 没兑现的事 + 人×2) / 本次最高分
牢固度 S   = 2 + 1.5×重要度 + 2×情绪 + 2×被想起次数 （天）；重要度 5 再加 60
记得的程度 = e^(−距最后一次想起（没想起过就是这段结束）的天数 / S)
分数       = 相关度 + 0.5×记得的程度 + 0.3×重要度/5
```

切词：中文两个字一组（去掉「我们」「什么」这类常用词），英文和数字按整个词。

## 配置（preset 里 compaction 那一组）

```yaml
- id: compaction-companion
  name: '@dsh-companion/core/compact'
  config:
    home: ~/.dsh-companion    # 必填
    preset: dsh-companion     # 必填，去掉思考只管这个 preset 的会话
    name: 大肥鱼                # 写经历时的称呼
    thresholdTokens: 24000    # 短期装多少
    retainTokens: 6000        # 压完留多少原话
    episodeProvider: your-provider   # 写经历用的模型，不填就用聊天的模型
    episodeModel: your-model
    # daily: false            # 关掉按天压
    # stripReasoning: false   # 关掉去掉思考
```

其余键原样交给 DSH 的 `compaction-basic`（它不认识的键会报错）。

## 测试

```bash
npm test                     # 切词、切段、检索、遗忘曲线
```

`compact.js` 要用 DSH 安装包里的压缩基类，不能单独在裸 Node 里 import；它的正确性靠真实 DSH 会话验证（见 [docs/verification.md](../../../docs/verification.md)）。全在临时目录的副本上跑，不碰任何人的家。

## 还没验证的

- DSH 升级后 `hostdeps.js` 还能不能找到 `dsh-compaction-basic`
- 去掉思考以后模型认不认（DSH 会给每条补空的 `reasoning_content`，应该没事）
- 本子改一次，系统提示变，那一轮缓存掉多少

## 改动记录

| 日期 | 改了什么 |
|---|---|
| 11-03 | 第一版：三层、原话档案、压缩写经历、按天压、BM25 + 遗忘曲线 + 连边、look_back、背景拆两份、去掉思考 |
| 11-04 | 一次 6 阵改成 3 阵、`maxTokens: 12000`；JSON 写在思考里也认；失败原因记进 `roughWhy`；每次压缩顺手重写 3 段粗经历 |
