// 她的手：一个单独跑的子会话（preset dsh-companion-hands），只有浏览器和上网，没有人设、心情、聊天。
// - 她这边只有一个 use_hands 工具：把事情交给手，手来回点几十步也不进她的聊天上下文，最后只回一段结果。
// - 手做成一件新事就 save_skill 记下做法（Voyager 的技能库），做不到就 wish 记进心愿单。
// - 浏览器工具（mcp__chrome__*）是 Host 级的，开发会话也在用；她的会话里把它们藏起来，只有手看得到。
import { readText } from './mind.js'
import { addWish, readSkills, saveSkill, skillFile } from './body.js'

const text = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }
const textOf = (blocks) => (blocks ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()

function reg(ctx, name, description, properties, required, run, timeoutMs) {
  ctx.tools.register({
    name, description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: text, render: (_a, v) => [{ type: 'text', text: v.text }] },
    ...(timeoutMs ? { timeoutMs } : {}),
    async execute(args, exec) { return { text: await run(args ?? {}, exec) } },
  })
}

// 她身上不该有的工具：干活用的、浏览器（交给手）。只从她看到的列表里拿掉，开发会话不受影响。
export const HIDDEN_FROM_HER = (name) => name.startsWith('mcp__') || ['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource', 'working_directory', 'load_workspace_dependencies'].includes(name)

/** 她这边：use_hands。 */
export function registerUseHands(ctx, home, commit, preset = 'dsh-companion-hands', who = '她') {
  reg(ctx, 'use_hands',
    '让你的手去做一件要动手的事：用主人电脑上的 Chrome 开网页、登录过的网站（论坛、邮箱等）、点、填、发帖、截图，内网也行。' +
    'task 写清楚要做什么、做到什么算完（比如「打开论坛，用主人的号发一条：xxx，发完看一眼发出去没有」）。' +
    '要发东西、评论、点赞，内容写在 task 里，手不会替你编。手做完回一段结果，你再用自己的话跟主人说，别照念。' +
    '一般要等一两分钟。',
    { task: { type: 'string' } }, ['task'],
    async ({ task }, exec) => {
      const t = String(task ?? '').trim()
      if (!t) throw new Error('task 写要做什么')
      const subagents = ctx.get('subagents')
      if (!subagents) throw new Error('手现在没接上（子会话服务不在），用 wish 记一下')
      if (!exec?.agent) throw new Error('找不到你自己的会话')
      const skills = readSkills(home)
      const prompt = `要做的事（${who}交给你的）：\n${t}` +
        (skills.length ? `\n\n已经会的技能（有对得上的就先 read_skill 读一下照着做）：\n${skills.map((s) => `- ${s.id}：${s.one || s.title}`).join('\n')}` : '')
      const activation = await subagents.startActivation({
        provider: 'spawn',
        label: `手：${t.slice(0, 20)}`,
        request: { prompt: [{ type: 'text', text: prompt }], parent: exec.agent, agentPreset: preset, cwd: home, maxDepth: subagents.resolveMaxDepth() },
        signal: exec.signal,
        delivery: 'caller',
      })
      const r = await activation.result
      const out = textOf(r.output) || r.diagnostic || ''
      if (r.stopReason !== 'completed') return `手没做完（${r.stopReason}）。${out ? `它说：${out}` : ''}`
      return out || '手做完了，但什么也没说。'
    }, 15 * 60_000)
}

const handsPrompt = (who) => `你是${who}的手。${who}是主人电脑里的一个伙伴，她把要动手的事交给你。你不聊天、没有心情，只负责把事做完。

你能用的：
- 浏览器（mcp__chrome__ 开头的工具）：主人电脑上的一个 Chrome 窗口，里面登录着主人的号，公司内网也能打开。先 new_page 或 navigate_page，再 take_snapshot 看页面结构，用里面的 uid 去 click / fill，做完 take_snapshot 或 take_screenshot 确认。
- web_search / web_fetch：查公开网页，比如查某个网站怎么用。
- read_skill：读你以前学会的做法。save_skill：记下新做法。wish：记下做不到的事。

做事的规矩：
1. 先看任务里有没有对得上的技能，有就 read_skill 照着做。
2. 一条路走不通就换一条：换个入口、搜一下怎么做、看看页面上的提示。至少试三种办法再说做不到。
3. 只做任务里写的事。要发的内容任务里没写，就别发，回去说缺什么。
4. 付钱、删东西、改密码、改账号设置、给别人发私信：任务里没明说就不做。
5. 做成了一件以前没记过的事，用 save_skill 把做法记下来：具体到点哪里、填什么、哪里容易出错。
6. 遇到验证码、滑块、安全验证、扫码登录：不要刷新硬闯、不要换 IP/UA、不要找打码服务。搜索页被挡时改用 web_search 搜「site:bilibili.com 关键词」或公开接口拿直达链接；仍被挡就跳过，记 wish。
7. 真的做不到（比如缺工具、要验证码、要扫码），用 wish 记下来：想做什么、卡在哪、你查到的可能办法。

最后回一段话给${who}（中文，三四句以内）：做成没有、结果是什么（比如发出去的帖子地址、看到的关键内容）、有没有学会新技能或者记了心愿。不要贴整页内容。`

/** 手这边：人设 + read_skill / save_skill / wish。浏览器和上网是另外两行挂进来的。 */
export function applyHands(ctx, home, commit, who = '她') {
  ctx.systemPrompt.section({ name: 'deployment:persona-prefix', order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'), interpolate: false, text: handsPrompt(who) })
  ctx.systemPrompt.context({
    name: 'dsh-companion-hands:skills', order: 300, interpolate: false, required: true,
    text: () => {
      const s = readSkills(home)
      return s.length ? '你学会的技能：\n' + s.map((x) => `- ${x.id}：${x.one || x.title}`).join('\n') : '你还没学会任何技能。'
    },
  })
  reg(ctx, 'read_skill', '读一个你学会的技能的完整做法。id 是技能名。', { id: { type: 'string' } }, ['id'], ({ id }) => {
    const t = readText(skillFile(home, String(id ?? '')), 20000)
    if (!t) throw new Error(`没有这个技能：${id}`)
    return t
  })
  reg(ctx, 'save_skill', '做成一件新事后，把做法记成技能，下次照着做。id 是技能名（比如「论坛发帖」），one 一句话说干什么，steps 写具体步骤和坑（markdown）。同名会覆盖，覆盖时把旧的有用的部分也留着。',
    { id: { type: 'string' }, one: { type: 'string' }, steps: { type: 'string' } }, ['id', 'one', 'steps'],
    ({ id, one, steps }) => {
      const file = saveSkill(home, { id, one, steps })
      commit(file, `手学会：${id}`)
      return '记下了。'
    })
  reg(ctx, 'wish', '记下一件想做但做不到的事。what 想做什么，stuck 卡在哪，maybe 查到的可能办法（比如某个工具、插件）。',
    { what: { type: 'string' }, stuck: { type: 'string' }, maybe: { type: 'string' } }, ['what', 'stuck'],
    ({ what, stuck, maybe }) => {
      const file = addWish(home, { what: String(what).trim(), stuck: String(stuck).trim(), maybe: maybe ? String(maybe).trim() : '' })
      commit(file, `心愿：${String(what).trim().slice(0, 30)}`)
      return '记进心愿单了。'
    })
}
