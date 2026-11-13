// 她的小本子：一个普通的 markdown 文件。
// - 每一步都把整本读进她的上下文（systemPrompt.context），所以你在编辑器里改完，下一句话她就看到了。
// - 给她一个 take_note 工具，让她自己往「关于主人」「我自己的事」两节里记一笔。
// - 这一行挂在伙伴 preset 里面，所以上下文和工具只出现在伙伴会话，别的会话看不到。
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { mindStable, registerMind, writeFileAtomic } from './mind.js'
import { registerSurf } from './surf.js'
import { registerPics } from './pics.js'
import { registerSocial } from './social.js'
import { bodyContext, memoryContext, readParts, recall, addWish } from './body.js'
import { HIDDEN_FROM_HER, registerUseHands } from './hands.js'
import { registerMemory } from './memory/chat.js'
import { companionConfig, ensureHome, resolveHome, resolveNotebook, resolvePersona } from './config.js'

export const name = 'dsh-companion-core'
export const inject = ['systemPrompt', 'tools']

const SECTIONS = { 主人: '## 关于主人', 我自己: '## 我自己的事' }
const MAX_CHARS = 12000

const notebookTemplate = (who) => `# ${who}的小本子

这是${who}自己的本子。主人可以随便翻、随便改。

## 主人给我的设定

（这一节只有主人写。写什么她都会当真，比如你们怎么认识的、她平时在电脑里待在哪、你希望她怎么叫你。）

## 关于主人

## 我自己的事
`

function registerBili(ctx) {
  const clean = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
  const secs = (n) => { n = Number(n) || 0; const m = Math.floor(n / 60); return `${m}:${String(n % 60).padStart(2, '0')}` }
  const get = async (path) => {
    const r = await fetch(`https://api.bilibili.com${path}`, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.bilibili.com/' }, signal: AbortSignal.timeout(15_000) })
    if (!r.ok) throw new Error(`B站接口 ${r.status}`)
    const d = await r.json()
    if (d.code !== 0) throw new Error(d.message || `B站接口 code ${d.code}`)
    return d.data
  }
  const line = (v) => `- ${clean(v.title)}｜UP：${clean(v.owner?.name ?? v.author)}｜${secs(v.duration)}｜播放 ${Number(v.stat?.view ?? v.play ?? 0).toLocaleString('zh-CN')}\n  https://www.bilibili.com/video/${v.bvid}`
  ctx.tools.register({
    name: 'bilibili',
    description: '看 B 站公开内容，不需要登录：query 搜视频，bvid 看一个视频，mode=popular/ranking 看热门或排行榜。搜索页被验证码挡住时优先用这个。',
    parameters: { type: 'object', properties: { query: { type: 'string' }, bvid: { type: 'string' }, mode: { type: 'string', enum: ['popular', 'ranking'] } }, additionalProperties: false },
    output: { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }, render: (_a, v) => [{ type: 'text', text: v.text }] },
    timeoutMs: 25000,
    async execute({ query, bvid, mode } = {}) {
      try {
        if (bvid) {
          const v = await get(`/x/web-interface/view?bvid=${encodeURIComponent(String(bvid).trim())}`)
          return { text: `${clean(v.title)}\nUP：${clean(v.owner?.name)}｜${secs(v.duration)}｜播放 ${Number(v.stat?.view ?? 0).toLocaleString('zh-CN')}\nhttps://www.bilibili.com/video/${v.bvid}\n${clean(v.desc).slice(0, 300)}` }
        }
        if (mode === 'popular' || mode === 'ranking') {
          const d = mode === 'ranking' ? await get('/x/web-interface/ranking/v2?rid=0&type=all') : await get('/x/web-interface/popular?ps=10&pn=1')
          return { text: `B站${mode === 'ranking' ? '排行榜' : '热门'}：\n` + (d.list ?? []).slice(0, 10).map(line).join('\n') }
        }
        const q = String(query ?? '').trim()
        if (!q) throw new Error('给 query、bvid 或 mode')
        const d = await get(`/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(q)}&page=1`)
        const list = (d.result ?? []).slice(0, 8)
        return { text: list.length ? `B站搜索「${q}」：\n` + list.map(line).join('\n') : `「${q}」没搜到视频。` }
      } catch (error) { return { text: `B站没看成：${error?.message ?? error}` } }
    },
  })
}

function today() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 同一个模块会被好几个人格的 preset 各加载一次，模板按本子文件记，别互相串。
const templates = new Map()
function ensureFile(file) {
  if (existsSync(file)) return
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, templates.get(file) ?? notebookTemplate('大肥鱼'), 'utf8')
}

const PAST = '## 过去的事'

// 给她看的本子：「过去的事」那一节不放进来（还在文件里，主人能翻）。
// 太厚时先丢最早记的条目，最新的一定留着；「主人给我的设定」一条都不丢。
export function notebookForHer(text, max = MAX_CHARS) {
  const lines = text.split('\n')
  const past = lines.findIndex((l) => l.trim() === PAST)
  if (past >= 0) {
    const next = lines.findIndex((l, i) => i > past && /^##\s/.test(l))
    lines.splice(past, (next < 0 ? lines.length : next) - past)
  }
  let section = ''
  const droppable = []
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) section = l.trim()
    else if (l.startsWith('- ') && section !== '## 主人给我的设定') droppable.push(i)
  })
  // 条目开头是日期，按日期从早到晚丢；同一天的按写的先后。
  droppable.sort((a, b) => (lines[a].slice(2, 12) < lines[b].slice(2, 12) ? -1 : lines[a].slice(2, 12) > lines[b].slice(2, 12) ? 1 : a - b))
  const gone = new Set()
  let size = lines.join('\n').length
  for (const i of droppable) {
    if (size <= max) break
    gone.add(i)
    size -= lines[i].length + 1
  }
  const kept = lines.filter((_, i) => !gone.has(i)).join('\n').trim()
  return gone.size ? `${kept}\n\n（本子太厚了，最早的 ${gone.size} 条没放进来。让主人帮你整理一下。）` : kept
}

const NOTEBOOK_HEAD =
  '下面是你的小本子（你自己记的，加上主人写给你的设定）。聊天时自然地用上，别照着念，也别说「我本子上写着」。' +
  '本子是你记得的事，跟他现在说的对不上时，以现在为准。' +
  '里面有的事已经过去了（面试面完了、约定做到了），就用 its_past 收起来。' +
  '记错了、主人纠正了你，马上用 fix_note 改掉，别再拿错的事去问他。\n\n'
const notebookText = (file) => NOTEBOOK_HEAD + readNotebook(file)

function readNotebook(file) {
  try {
    ensureFile(file)
    return notebookForHer(readFileSync(file, 'utf8'))
  } catch (error) {
    return `（小本子打不开：${error.message}）`
  }
}

// 把一件已经过去的事从「关于主人」「我自己的事」挪到「过去的事」：不再每次给她看，但不删。
export function moveToPast(file, match, note) {
  const lines = readFileSync(file, 'utf8').replace(/\s+$/, '').split('\n')
  let section = ''
  const hits = []
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) section = l.trim()
    else if (l.startsWith('- ') && Object.values(SECTIONS).includes(section) && l.includes(match)) hits.push(i)
  })
  if (hits.length === 0) throw new Error(`本子里没有包含「${match}」的条目`)
  if (hits.length > 1) throw new Error(`包含「${match}」的有 ${hits.length} 条，多写几个字，只对上一条`)
  const [line] = lines.splice(hits[0], 1)
  writeFileAtomic(file, lines.join('\n') + '\n')
  appendUnder(file, PAST, `${line}（${today()} 过去了${note ? `：${note}` : ''}）`)
  return line
}

// 记错了：把一条改成对的（text），或者作废（不给 text，挪到「过去的事」并标上「记错了」）。不删，主人能翻到改过什么。
export function fixLine(file, match, text, why) {
  const lines = readFileSync(file, 'utf8').replace(/\s+$/, '').split('\n')
  let section = ''
  const hits = []
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) section = l.trim()
    else if (l.startsWith('- ') && Object.values(SECTIONS).includes(section) && l.includes(match)) hits.push(i)
  })
  if (hits.length === 0) throw new Error(`本子里没有包含「${match}」的条目`)
  if (hits.length > 1) throw new Error(`包含「${match}」的有 ${hits.length} 条，多写几个字，只对上一条`)
  const old = lines[hits[0]]
  if (text) lines[hits[0]] = `- ${today()} ${text}`
  else lines.splice(hits[0], 1)
  writeFileAtomic(file, lines.join('\n') + '\n')
  appendUnder(file, PAST, `${old}（${today()} 记错了${text ? '，改成了上面那条' : ''}：${why}）`)
  return old
}

// 把一行插到对应小节的末尾（下一个 "## " 之前）；小节不存在就补在文件末尾。
function appendUnder(file, heading, line) {
  ensureFile(file)
  const lines = readFileSync(file, 'utf8').replace(/\s+$/, '').split('\n')
  let start = lines.findIndex((l) => l.trim() === heading)
  if (start < 0) {
    lines.push('', heading)
    start = lines.length - 1
  }
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  if (end < 0) end = lines.length
  let at = end
  while (at - 1 > start && lines[at - 1].trim() === '') at--
  lines.splice(at, 0, line)
  writeFileAtomic(file, lines.join('\n') + '\n')
}

// 她的目录（home）如果是 git 仓库，就把这次改动提交一次，方便以后翻她哪天变了。
// 多个工具可能同时提交，排成一队，免得 git 锁冲突。
let queue = Promise.resolve()
function committer(home, who = { name: '大肥鱼', email: 'persona@local' }) {
  return (file, message) => {
    if (!existsSync(join(home, '.git'))) return
    const rel = relative(home, file)
    const git = (args) => new Promise((resolve) => execFile('git', ['-C', home, ...args], () => resolve()))
    queue = queue
      .then(() => git(['add', '--', rel]))
      .then(() => git(['-c', `user.name=${who.name}`, '-c', `user.email=${who.email}`, 'commit', '-q', '-m', message, '--', rel]))
  }
}

// 人设是内核，放在独立的 persona.md 里，每一步都重新读：改完文件，下一句话就生效。
// 读不到时沿用上一次读到的内容，不让一次文件错误打断聊天。
// 系统提示 = 人设 + 稳的背景（本子、身体、现在的她、对他的了解……）。这一段是 complete 的，就是整个系统提示。
// 稳的背景放这里：一天只变十来次，变了是原地换；会变的小块（心情、感官）留在每轮的快照里。
function registerPersona(ctx, file, stable = () => []) {
  const first = readFileSync(file, 'utf8').trim()
  if (!first) throw new Error(`dsh-companion: 人设文件是空的：${file}`)
  let last = first
  ctx.systemPrompt.section({
    name: 'deployment:persona-prefix',
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    complete: true,
    interpolate: false,
    text: (c) => {
      try {
        const text = readFileSync(file, 'utf8').trim()
        if (text) last = text
      } catch {}
      let extra = []
      try { extra = stable(c) } catch (error) { extra = [`（背景读不出来：${error.message}）`] }
      return [last, ...extra].filter(Boolean).join('\n\n')
    },
  })
}

// 一个 preset 一个人：config.name 是她的名字（git 提交人、本子模板用），config.hands 关掉就没有「手」。
// 只给 config.home 也行：本子、人设在家里，第一次跑会自动种出来。
export function apply(ctx, config = {}) {
  const { name: who, timeZone } = companionConfig(config)
  const home = resolveHome(config)
  ensureHome(home, { name: who })
  const file = resolveNotebook(config, home)
  const personaFile = resolvePersona(config, home)
  templates.set(file, notebookTemplate(who))
  ensureFile(file)
  if (existsSync(personaFile)) {
    registerPersona(ctx, personaFile, (c) => [
      notebookText(file),
      [bodyContext(home, (n) => !!ctx.tools.get(n, c?.scope)), memoryContext(home)].filter(Boolean).join('\n\n'),
      mindStable(home),
    ])
  }
  // 她是人，不是干活的：沙箱、审批、DSH 源码目录、网页地址这些运行信息都不给她看。
  // 只挡她这个 preset 里的；她自己的本子、心情这些是 required，不受影响。
  ctx.systemPrompt.suppressRuntimeContext()
  const commit = committer(home, { name: who, email: config.email ?? 'persona@local' })
  registerMind(ctx, home, commit)
  registerSurf(ctx, home, commit)
  registerBili(ctx)
  registerPics(ctx, home, commit)
  registerSocial(ctx, home)
  // 记忆：原话档案、每轮想起来、look_back（写经历在压缩那边：./memory/compact.js）
  registerMemory(ctx, home, { name: who })
  registerBody(ctx, home, commit, config.hands === false ? null : config.handsPreset ?? 'dsh-companion-hands', who)

  // 没有独立人设文件时，本子和稳的背景退回每轮的快照
  if (!existsSync(personaFile)) ctx.systemPrompt.context({
    name: 'dsh-companion:notebook', order: 300, interpolate: false, required: true,
    text: () => [notebookText(file), mindStable(home)].join('\n\n'),
  })

  // 时区只影响时间说法；DSH 自己的时间上下文用它。
  if (timeZone) ctx.systemPrompt.context({
    name: 'dsh-companion:timezone', order: 290, interpolate: false,
    text: () => `主人这边的时区是 ${timeZone}，说时间按这个来。`,
  })

  ctx.tools.register({
    name: 'take_note',
    description:
      '往你的小本子里记一笔，以后每次聊天你都会看到。' +
      '记主人的事：他说过的重要的话、喜好、约定、最近的状态、发生在他身上的事。' +
      '记你自己的事：你们之间发生的事、你的心情变化、你答应过他的事、你自己的小日子。' +
      '只记以后还用得上的，一次一件事，一句话写清，不用写日期（会自动加）。本子里已经有的就别重复记。' +
      '主人的事要是他自己说的，不是你猜的；他临时的安排（今晚加班）别记成长期的习惯；开玩笑的别当真记。' +
      '要记：「主人下周三面试字节」「主人不吃香菜」。不用记：「主人说哈哈」「主人说晚安」。' +
      '安静地记，回复里不要说「记下了」「我记住了」。',
    parameters: {
      type: 'object',
      properties: {
        about: { type: 'string', enum: ['主人', '我自己'], description: '记在哪一节。' },
        text: { type: 'string', description: '要记的事，一句话，不带日期。你自己写「我」，主人写「主人」。' },
      },
      required: ['about', 'text'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
      render: () => [{ type: 'text', text: '记好了。' }],
    },
    async execute(args) {
      const heading = SECTIONS[args?.about]
      const text = typeof args?.text === 'string' ? args.text.replace(/\s+/g, ' ').trim() : ''
      if (!heading) throw new Error('about 只能是「主人」或「我自己」')
      if (!text) throw new Error('text 不能是空的')
      if (text.length > 300) throw new Error('太长了，一句话写清，300 字以内')
      appendUnder(file, heading, `- ${today()} ${text}`)
      commit(file, `记一笔（${args.about}）：${text.slice(0, 40)}`)
      return { ok: true }
    },
  })

  ctx.tools.register({
    name: 'fix_note',
    description:
      '本子里有一条记错了（主人纠正你、你发现自己想岔了、事情根本没发生），就改掉。' +
      '给 text 就改成对的那句；不给 text 就作废这条。错的那条会留在「过去的事」里标上记错了，不会再摆在你面前。' +
      '比如本子写「他明天面试」，他说「哪有面试，我去玩了」：match 写「面试」，text 写「主人那两天去展览玩了，没有面试」。悄悄改，回复里不要说。' +
      '惦记的事记错了用 fix_reminder。',
    parameters: {
      type: 'object',
      properties: {
        match: { type: 'string', description: '记错那条的一段原文，几个字就行，要能只对上一条。' },
        text: { type: 'string', description: '改成对的，一句话，不带日期；作废就不填。' },
        why: { type: 'string', description: '怎么发现记错的，一句话。' },
      },
      required: ['match', 'why'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      render: () => [{ type: 'text', text: '改好了。' }],
    },
    async execute(args) {
      const match = typeof args?.match === 'string' ? args.match.trim() : ''
      if (match.length < 2) throw new Error('match 至少写两个字')
      const text = typeof args?.text === 'string' ? args.text.replace(/\s+/g, ' ').trim() : ''
      if (text.length > 300) throw new Error('太长了，一句话写清，300 字以内')
      const why = typeof args?.why === 'string' ? args.why.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
      if (!why) throw new Error('why 不能是空的')
      const line = fixLine(file, match, text, why)
      commit(file, `记错了：${line.slice(2, 42)}`)
      return { ok: true }
    },
  })

  ctx.tools.register({
    name: 'its_past',
    description:
      '本子里有一件事已经过去了（面试面完了、出差回来了、病好了、约定做到了），就把它收起来：以后不再每次摆在你面前，但还留在本子里。' +
      '结果要是你知道，写进 note（比如「面过了，挺顺」）；结果里有以后还用得上的新事，另外用 take_note 记。悄悄做，回复里不要说。',
    parameters: {
      type: 'object',
      properties: {
        match: { type: 'string', description: '那条的一段原文，几个字就行，要能只对上一条。' },
        note: { type: 'string', description: '后来怎么样了，一句话；不知道就留空。' },
      },
      required: ['match'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      render: () => [{ type: 'text', text: '收好了。' }],
    },
    async execute(args) {
      const match = typeof args?.match === 'string' ? args.match.trim() : ''
      if (match.length < 2) throw new Error('match 至少写两个字')
      const note = typeof args?.note === 'string' ? args.note.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
      const line = moveToPast(file, match, note)
      commit(file, `过去了：${line.slice(2, 42)}`)
      return { ok: true }
    },
  })
}

// ---- 身体、记忆索引（body.js），手（hands.js）。
function registerBody(ctx, home, commit, handsPreset, who = '她') {
  // 手是她的子会话（技能库写在她家里），别的人格没有手，不挂 use_hands。
  if (handsPreset) registerUseHands(ctx, home, commit, handsPreset, who)

  // 浏览器这类工具是 Host 级的（开发会话也用），在她这里藏起来：她只看得到 use_hands。
  ctx.on('system-prompt/assemble', async (_a, _c, next) => {
    const assembly = await next()
    return { ...assembly, tools: assembly.tools.filter((t) => !HIDDEN_FROM_HER(t.name)) }
  })


  const text = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }
  const reg = (name, description, properties, required, run) => ctx.tools.register({
    name, description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: text, render: (_a, v) => [{ type: 'text', text: v.text }] },
    async execute(args) { return { text: await run(args ?? {}) } },
  })
  reg('look_body', '看你某个身体部位的细节：能做什么、做不到什么、怎么用。part 是部位的英文名（eyes / ears / mouth / legs / hands）。',
    { part: { type: 'string' } }, ['part'],
    ({ part }) => {
      const p = readParts(home).find((x) => x.id === part)
      if (!p) throw new Error(`没有这个部位，有的是：${readParts(home).map((x) => x.id).join('、')}`)
      return p.text
    })
  reg('recall', '在你的记忆里搜：日记、经历、本子（包括过去的事）、对他的了解、学来的说法、想做的事。query 写几个关键词。他问「你还记得…吗」、你想不起来某件事的时候用。',
    { query: { type: 'string' } }, ['query'], ({ query }) => recall(home, query))
  reg('wish', '想做一件事，但哪个部位都做不到（手也不行），就记进心愿单，主人看到会帮你装新本事。what 想做什么，stuck 卡在哪，maybe 你知道的可能办法。',
    { what: { type: 'string' }, stuck: { type: 'string' }, maybe: { type: 'string' } }, ['what', 'stuck'],
    ({ what, stuck, maybe }) => {
      const w = String(what ?? '').trim(); const s = String(stuck ?? '').trim()
      if (!w || !s) throw new Error('what 和 stuck 都要写')
      const file = addWish(home, { what: w, stuck: s, maybe: maybe ? String(maybe).trim() : '' })
      commit(file, `心愿：${w.slice(0, 30)}`)
      return '记进心愿单了。'
    })
}
