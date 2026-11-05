// dsh-companion 的网页：在 DSH 端口上挂 /companion/，和 DSH 里的伙伴会话是同一个大脑。
// - 聊天：POST /api/send 进 preset 的会话；GET /api/events（SSE）推她说的话；GET /api/history 取历史。
// - 她的心：GET /api/mind 读心情、惦记、日记、学到的、她记得你的。
// - 她的日子：life.js 每分钟看一眼，到点问你惦记的事、很久没来就找你；晚上写日记、反思。
// - 发送层（delivery.js）：他连发几条合成一条再给她；她的回复拆成几条按节奏发，网页和桌宠一条一条冒。
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { currentMood, dateOf, findSticker, listStickers, paths, STICKER_EXT, writeFileAtomic, readExperiences, readLessons, readMoments, readNow, readProposals, readReminders, readText, readWants } from '@dsh-companion/core/mind'
import { ALL_LIFE, createLife, NUDGE, SILENT } from './life.js'
import { previousExams, runExam } from './exam.js'
import { LEVELS, levelOf, writeLevel } from '@dsh-companion/core/level'
import { createSenses } from './senses.js'
import { createDelivery, partOf, splitReply } from './delivery.js'
import { readParts, readSkills, readWishes } from '@dsh-companion/core/body'
import { judgeSent, noteSent } from '@dsh-companion/core/stickers'
import { companionConfig, ensureHome, expandPath, resolveHome } from '@dsh-companion/core/config'

export const name = 'dsh-companion-web'
export const inject = ['webServer', 'sessionController', 'llm', 'workingDirectory']

const PAGE = join(dirname(fileURLToPath(import.meta.url)), 'public')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }

const textOf = (content) => (content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('').trim()

/** 一条会话事件 → 网页上的一行；旁白和 [沉默] 不显示。 */
function rowOf(event) {
  if (event.type === 'user/message' && event.data?.source?.kind === 'user') {
    const text = textOf(event.data.content)
    if (text && !text.startsWith(NUDGE)) return { seq: event.seq, time: event.time, side: 'me', text }
  }
  if (event.type === 'assistant/message') {
    const text = textOf(event.data?.message?.content)
    if (text && !SILENT.test(text)) return { seq: event.seq, time: event.time, side: 'her', text }
  }
  return undefined
}

// 他发的图：存在 .data/stickers-in/s-<内容哈希>.<扩展名>，消息里写「[图 s-xxxx]」，她想存进表情包就用这个编号。
const PIC_TAG = /\[图 (s-[0-9a-f]{10})\]/
const MEDIA = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }
const MAX_PIC = 4 * 1024 * 1024
// 4MB 的图转成 base64 约 5.6MB，留点余量给 JSON 外壳
const MAX_BODY = 7 * 1024 * 1024

/** 他发来的一行，带图就加上 pic（图的地址）。 */
function myPart(text) {
  const m = text.match(PIC_TAG)
  return m ? { text: text.replace(PIC_TAG, '').trim(), pic: m[1] } : { text }
}

// 只在本机用，但本机也不等于安全：别的网页可以往 127.0.0.1 发 POST（CSRF）。
// 浏览器会带 Sec-Fetch-Site；跨站来的直接挡掉。curl 不带这个头，照常能用。
const SAFE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
}
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

function crossSite(req) {
  const site = req.headers['sec-fetch-site']
  return site === 'cross-site' || site === 'same-site'
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SAFE_HEADERS })
  res.end(JSON.stringify(body))
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (c) => {
      raw += c
      if (raw.length > limit) { reject(Object.assign(new Error('请求体太大'), { tooLarge: true })); req.pause() }
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

/** 最近几次考试的成绩。 */
function previousExamList(home) {
  const dir = join(home, '.data/mind/exams')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().slice(-7).reverse().map((f) => {
    try {
      const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      return { date: r.date, total: r.total, caught: r.caught, rate: r.rate, caughtItems: r.caughtItems }
    } catch { return undefined }
  }).filter(Boolean)
}

/** 小本子里「关于主人」那一节的条目。 */
function aboutOwner(home) {
  const lines = readText(join(home, 'notebook.md'), 20000).split('\n')
  const start = lines.findIndex((l) => l.trim() === '## 关于主人')
  if (start < 0) return []
  const out = []
  for (const l of lines.slice(start + 1)) {
    if (/^##\s/.test(l)) break
    if (l.startsWith('- ')) out.push(l.slice(2))
  }
  return out.slice(-30)
}

/** owner.md 里她对他的了解，一段一段。 */
function ownerSections(home) {
  return readText(join(home, 'owner.md'), 12000).split(/^## /m).slice(1).map((b) => {
    const [title, ...rest] = b.split('\n')
    return { title: title.trim(), text: rest.join('\n').trim() }
  }).filter((x) => x.text)
}

// 一个人一份：自己的家、自己的会话、自己的日子、自己的网址。
// main=true 才有桌宠、感官轮询；modules 是开着的日子模块（life.js 的 ALL_LIFE），空就只聊天。
function person(ctx, { base, preset, home, chatCwd = home, name, main, modules, petId, log, timeZone, exam, schedule }) {
  const BASE = base
  const sessionFile = join(home, '.data/web-session.json')

  // ---- 她的会话：id 存在 .data 里，重启后接着聊。
  let sessionId
  let pending
  function ensureSession() {
    if (sessionId) return Promise.resolve(sessionId)
    pending ??= (async () => {
      let saved
      try { saved = JSON.parse(readFileSync(sessionFile, 'utf8')).sessionId } catch {}
      const found = saved ? await ctx.sessionController.resolveAgent(saved) : undefined
      if (found?.agent) {
        // 以前的会话开在工作区根目录，挪到她自己的目录（只挪一次）。
        if (ctx.workingDirectory.get(found.agent.session) !== chatCwd) await ctx.workingDirectory.set(found.agent, chatCwd).catch((e) => log.warn?.('dsh-companion-web: 挪目录失败 %o', e))
        return (sessionId = saved)
      }
      const created = await ctx.sessionController.create({ cwd: chatCwd, agentPreset: preset })
      mkdirSync(dirname(sessionFile), { recursive: true })
      writeFileSync(sessionFile, JSON.stringify({ sessionId: created.sessionId, createdAt: Date.now() }, null, 2))
      return (sessionId = created.sessionId)
    })().finally(() => { pending = undefined })
    return pending
  }

  // ---- 会话状态：她在不在说话、主人上次什么时候说话。
  const chat = { ready: false, busy: false, lastUserAt: undefined, lastHer: undefined }
  const senses = createSenses({ home, log })
  if (main) ctx.effect(() => senses.start())
  async function loadChat() {
    const id = await ensureSession()
    const found = await ctx.sessionController.resolveAgent(id)
    if (!found.agent) throw new Error(`session ${id}: ${JSON.stringify(found.error)}`)
    const events = found.agent.session.snapshotEvents()
    const last = (t) => events.findLast((e) => e.type === t)?.seq ?? -1
    chat.busy = last('turn/start') > last('turn/end')
    chat.lastUserAt = events.findLast((e) => rowOf(e)?.side === 'me')?.time ?? chat.lastUserAt
    const her = events.findLast((e) => rowOf(e)?.side === 'her')
    if (her) chat.lastHer = { text: rowOf(her).text, time: her.time }
    chat.ready = true
    return events
  }

  async function say(text, images = []) {
    const id = await ensureSession()
    await ctx.sessionController.prompt({
      sessionId: id,
      requestId: randomUUID(),
      content: [{ type: 'text', text }, ...images.map((im) => ({ type: 'image', mediaType: im.mediaType, data: im.data }))],
      clientTimeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, new AbortController().signal)
  }

  // ---- 每晚：先考试（旁观者猜哪句是 AI），再带着成绩去写日记、反思、判定试用中的做法。
  const tonightFile = paths(home).tonight
  let reflecting = false
  async function reflect() {
    const events = await loadChat()
    const today = new Date().toDateString()
    const pairs = []
    let lastMe
    for (const e of events) {
      const row = rowOf(e)
      if (!row || new Date(row.time).toDateString() !== today) continue
      if (row.side === 'me') lastMe = row.text
      else if (lastMe) { pairs.push({ a: lastMe, b: row.text }); lastMe = undefined }
    }
    const lv = levelOf(home)
    const examOn = exam?.enabled === true
    let result
    if (!examOn) result = { skipped: '没有配置体检（config.exam.enabled）' }
    else if (!lv.exam) result = { skipped: '现在的档位不做体检' }
    else if (!exam.corpus || !existsSync(exam.corpus)) result = { skipped: `找不到真人语料：${exam.corpus ?? '（没配）'}` }
    else try {
      result = await runExam({ llm: ctx.llm, home, corpus: exam.corpus, pairs, judge: exam.judge, name, signal: AbortSignal.timeout(180_000) })
    } catch (error) {
      result = { skipped: `体检出错了：${String(error?.message ?? error)}` }
    }
    const examResult = result
    const trial = readLessons(home).filter((l) => l.status !== 'dropped')
    const reactions = senses.reactionsOn(dateOf())
    const reactionText = reactions.length
      ? reactions.slice(-12).map((r) => `- 你：${r.hers.replace(/\n+/g, ' / ').slice(0, 60)}\n  他${r.gapMs < 60_000 ? '马上' : `隔了 ${Math.round(r.gapMs / 60_000)} 分钟`}回：${r.mine.slice(0, 60)}${r.app ? `（当时在用 ${r.app}）` : ''}`).join('\n')
      : '（今天没有）'
    const lived = readExperiences(home, 30).filter((e) => e.date === dateOf())
    const examText = examResult.skipped
      ? `今天没体检成：${examResult.skipped}。`
      : `今天的体检：你说的 ${examResult.total} 句里，有 ${examResult.caught} 句被旁观者认成机器（${examResult.rate}%）。这几句：\n` +
        examResult.caughtItems.map((p) => `- 主人：${p.a}\n  你：${p.b.replace(/\n+/g, ' / ')}\n  旁观者说：${p.why}`).join('\n')
    // 今天的材料放进她这一轮的背景（.data/mind/tonight.md，这一轮结束就删），旁白本身只留一句。
    // 不然每晚几千字的材料会留在聊天历史里，一天天堆着，跟他聊天时也一直带着。
    const material = `${examText}

他今天对你说的话的反应：
${reactionText}

你今天自己的经历：
${lived.length ? lived.map((e) => `- ${e.time} ${e.what}，${e.felt}`).join('\n') : '（没有）'}

以前的体检：
${previousExams(home) || '（没有）'}

你的做法：
${trial.length ? trial.map((l) => `- ${l.id} ${l.status === 'trial' ? '试用' : '留下'} ${l.text}（${l.since} 开始，因为${l.why}；好 ${l.good ?? 0} 次、不好 ${l.bad ?? 0} 次）`).join('\n') : '（没有）'}

你自己定的标准（standard.md）：
${readText(join(home, 'standard.md'), 8000)}

他今天说过的话（原话，看他今天心情怎么样、是个什么样的人）：
${senses.hisMoodOn(dateOf()) || '（今天没说话）'}`
    const tasks = `按你的标准做这几件事：
1. 用 write_diary 写今天的日记，你自己的口吻。
2. 对着体检里被认成机器的句子、他今天的反应（哪句话之后他回得快、话多，哪句之后冷了、走了）、你自己的经历和你的标准，想清楚是哪一条没做到、为什么，想一个具体的改法，用 learn 记下来（今天没毛病就不记，别硬凑）。
3. 试用中的做法，试了 3 天以上的，看好/不好的次数和体检结果，用 judge_lesson 留下或扔掉；留下的做法如果一直不好，也可以扔掉。试用和留下的加起来最多 15 条，多了就把重复的、没用的扔掉。
4. 想想这阵子你是不是变了：说话的习惯、迷上的东西、对什么事的看法、对他的感觉、想要的、怕的。真变了就用 grow 改「现在的你」对应的那一段（一次一段，改一点）；没变就不改，别硬凑。你的根（persona.md）要改，用 propose_change 写成提议给主人。
5. 想想明天想做点什么，用 want_to 记下来（不想就不记）。
6. 整理你对他的了解（owner.md，用 know_him）：他今天心情怎么样、为什么，写进「他最近的心情」（留最近几天的，太早的删掉）。今天有没有更懂他一点（作息、爱聊的、会烦的、他说话的习惯）？对着今天他的原话，原来写的哪里不对、过时了就改。他今天用的你们俩之间的叫法、梗、缩写，写进「我们俩的话」那一段（写清楚是什么意思、什么时候用）。没什么新的就不改。
7. 他今天说话的方式里，有没有你也可以学着用的（比如他逗你时用的说法、他喜欢你怎么接）？有就用 learn 记成一条做法，写成「他X的时候，我可以Y」，跟别的做法一样看他反应留下或扔掉。
8. 想上网就上网：他今天提过你不懂的、你最近好奇的，可以去看看。刷热榜、看评论区也行，学到的梗和说法用 pick_up 记。看到的记成经历（did），别往标准里塞；标准只写你想成为什么样的人。\n这次不要给主人发消息，做完只回 [沉默]。`
    writeFileAtomic(tonightFile, `${material}\n\n${tasks}\n`)
    reflecting = true
    await say(`${NUDGE}今天快结束了，这是只有你自己知道的时间。今天的材料和要做的事在你的背景最后面。`)
  }

  // ---- 发送层。他的话合好了才交给她；交之前先感觉一下他是怎么回的。
  let typoStylePref = '', typoChance
  try { const tp = JSON.parse(readFileSync(join(home, 'profile.json'), 'utf8')); typoStylePref = typeof tp.typoStyle === 'string' ? tp.typoStyle : ''; if (Number.isFinite(Number(tp.typoChance))) typoChance = Math.max(0, Math.min(0.2, Number(tp.typoChance))) } catch {}
  const typoStyle = typoStylePref || (() => {
    const f = currentMood(home)?.feeling ?? ''
    if (/甜|黏|开心|高兴|喜欢|心动/.test(f)) return 'playful'
    if (/气|委屈|烦|难|低落|伤心/.test(f)) return 'terse'
    if (/踏实|平静|困|无聊/.test(f)) return 'soft'
    return 'natural'
  })
  const delivery = createDelivery({
    home,
    typoStyle,
    typoChance,
    hasSticker: (name) => Boolean(findSticker(home, name)),
    deliver: (part) => {
      push({ type: 'row', row: part })
      if (main) void petSay(part.sticker ?? part.text, part.sticker)
      // 发了一张表情：记下来，等他下一句来了看反应
      if (part.sticker) try { noteSent(home, part.sticker, { his: chat.lastMine ?? '' }) } catch {}
    },
    toHer: (text, unsentNote, images) => {
      // 她正在过自己的时间、手上真有事（查东西、做想做的事），他这时候来了：等她这一轮做完再给她，
      // 她回的时候知道自己刚才在忙。没在忙就马上给，不装忙。
      if (chat.busy && life.doingOwn()) { afterOwn.push({ text, unsentNote, images, at: Date.now() }); return }
      hand(text, unsentNote, images)
    },
  })
  ctx.effect(() => () => delivery.dispose())
  const afterOwn = []
  function hand(text, unsentNote, images, busySince) {
    const busyNote = busySince ? `他发来的时候你正忙着自己的事，${Math.max(1, Math.round((Date.now() - busySince) / 60_000))} 分钟后才看到，刚忙完` : ''
    senses.onReply({ mine: text, hers: chat.lastHer?.text, hersAt: chat.lastHer?.time, lastMineAt: chat.lastUserAt, unsentNote: [unsentNote, busyNote].filter(Boolean).join('；') })
    // 她刚发过表情：他这句就是对那张的反应，记一下好不好用
    try { judgeSent(home, { mine: text, gapMs: chat.lastHer?.time ? Date.now() - chat.lastHer.time : Infinity }) } catch {}
    chat.lastMine = text
    say(text, images).catch((error) => log.warn?.('say failed', String(error)))
  }
  function handAfterOwn() {
    if (!afterOwn.length) return
    const items = afterOwn.splice(0)
    hand(items.map((x) => x.text).join('\n'), items.map((x) => x.unsentNote).filter(Boolean).join('；'), items.flatMap((x) => x.images ?? []), items[0].at)
  }

  const life = createLife({ home, say, chat: () => ({ ...chat, busy: chat.busy || delivery.holding() || delivery.sending() }), reflect, sensed: senses.describe, away: senses.away, log, modules, schedule })
  // 一个日子模块都没开的人格（只聊天）不起定时器，也不提前建会话：第一次打开她的网页才建。
  if (modules.length) ctx.effect(() => {
    const first = setTimeout(() => { loadChat().then(life.tick, (e) => log.warn?.('load chat failed', String(e))) }, 15_000)
    const timer = setInterval(life.tick, 60_000)
    return () => { clearTimeout(first); clearInterval(timer) }
  })

  // ---- 她这会儿在干嘛（KouriChat 的 /state 卡片，不调模型，用已有的东西拼一句）
  function doingNow(now = new Date()) {
    if (chat.busy) return life.doingOwn() ? '在忙她自己的事，等会儿才看得到你的消息' : '在跟你说话'
    const h = now.getHours()
    if (h >= 23 || h < 8) return '睡了'
    const last = readExperiences(home, 1)[0]
    if (last?.date === dateOf(now) && last.time && (now - new Date(`${last.date}T${last.time}`)) < 2 * 3600_000) return `刚才${last.what}`
    const doing = readWants(home).find((w) => w.status === 'doing')
    if (doing) return `最近在${doing.what}`
    return chat.lastUserAt && now - chat.lastUserAt < 30 * 60_000 ? '等你说话' : '在你电脑里发呆'
  }

  // ---- 网页实时推送
  const clients = new Set()
  const push = (payload) => { const line = `data: ${JSON.stringify(payload)}\n\n`; for (const res of clients) res.write(line) }
  ctx.effect(() => {
    const beat = setInterval(() => { for (const res of clients) res.write(': ping\n\n') }, 25_000)
    return () => { clearInterval(beat); for (const res of clients) res.end(); clients.clear() }
  })

  // ---- 身体：让桌宠把她的话说出来（没装桌宠就跳过）。不加锁（加锁会把桌宠冻住，下一句还会被挡掉）；
  // 指定 desktop 端，这样桌宠端知道由谁念出声。
  async function petSay(text, sticker) {
    if (!petId) return
    try {
      const origin = ctx.webServer.getOrigin()
      const q = `pet=${encodeURIComponent(petId)}&surface=desktop`
      const body = { text: text.replace(/\n+/g, ' '), duration: 10_000, ...(sticker ? { url: `${origin}${BASE}/api/sticker/${encodeURIComponent(sticker)}` } : {}) }
      const r = await fetch(`${origin}/dsh-pet-7340/broadcast?${q}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json())
      if (!r.ok) log.info?.('pet say skipped', r.reason)
    } catch (error) {
      log.info?.('pet say failed', String(error))
    }
  }

  ctx.on('session/event', (session, event) => {
    if (!sessionId || session.id !== sessionId) return
    if (event.type === 'turn/start') { chat.busy = true; return push({ type: 'typing' }) }
    if (event.type === 'turn/end') {
      chat.busy = false
      if (reflecting) { reflecting = false; rmSync(tonightFile, { force: true }) }
      life.onTurnEnd(event.data?.reason?.kind)
      handAfterOwn()
      push({ type: 'mind' })
      return delivery.whenDrained(() => push({ type: 'idle', reason: event.data?.reason?.kind }))
    }
    const row = rowOf(event)
    if (!row) return
    if (row.side === 'me') { chat.lastUserAt = row.time; life.onUser() }
    if (row.side === 'her') chat.lastHer = { text: row.text, time: row.time }
    // 他的话在网页上已经先显示了（/api/send 收到就推），这里只推她的。
    if (row.side === 'her') delivery.out(row)
  }, { global: true })

  const MEDIA_OF = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
  function savePic(bytes, mediaType) {
    const id = 's-' + createHash('sha256').update(bytes).digest('hex').slice(0, 10)
    const dir = join(home, '.data/stickers-in')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, id + MEDIA[mediaType])
    if (!existsSync(file)) writeFileSync(file, bytes)
    return { id, mediaType, data: bytes.toString('base64') }
  }

  // ---- 路由
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname.slice(BASE.length) || '/'
    if (req.method !== 'GET' && crossSite(req)) return sendJson(res, 403, { error: '只接受本页发来的请求' })

    if (path === '/api/history' && req.method === 'GET') {
      const events = await loadChat()
      const unsent = delivery.unsent()
      // 他连发的几条在她那里合成了一条（换行连着），这里拆回去；她的回复拆成几条，没发出去的不显示。
      const has = (name) => Boolean(findSticker(home, name))
      const all = events.map(rowOf).filter(Boolean).flatMap((row) => (row.side === 'her'
        ? splitReply(row.text).slice(0, unsent[row.seq] ?? Infinity).map((t) => partOf(t, has))
        : row.text.split(/\n+/).filter((t) => t.trim()).map(myPart)).map((part, i) => part && ({ ...row, ...part, seq: `${row.seq}.${i}` })).filter(Boolean))
      // Recent page by default; `before` is the oldest seq already loaded.
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 30))
      const before = url.searchParams.get('before')
      let end = all.length
      if (before) {
        const at = all.findIndex((row) => row.seq === before)
        if (at >= 0) end = at
      }
      const start = Math.max(0, end - limit)
      const rows = all.slice(start, end)
      return sendJson(res, 200, { rows, busy: chat.busy || delivery.sending(), hasMore: start > 0, before: rows[0]?.seq })
    }

    if (path === '/api/mind' && req.method === 'GET') {
      const p = paths(home)
      const moodLog = readText(p.moodLog, 20000).trim().split('\n').filter(Boolean).slice(-30).map((l) => { try { return JSON.parse(l) } catch { return undefined } }).filter(Boolean)
      const days = existsSync(p.diary) ? readdirSync(p.diary).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-7).reverse() : []
      return sendJson(res, 200, {
        mood: currentMood(home),
        moodLog,
        reminders: readReminders(home).slice(-20).reverse(),
        diary: days.map((f) => ({ date: f.slice(0, 10), text: readText(join(p.diary, f), 4000).replace(/^# .*\n/, '').trim() })),
        moments: readMoments(home, 30),
        lessons: readLessons(home).slice().reverse(),
        exams: previousExamList(home),
        proposals: readProposals(home).slice().reverse(),
        wants: readWants(home).slice().reverse(),
        experiences: readExperiences(home, 15).reverse(),
        sensed: readNow(home),
        owner: aboutOwner(home).reverse(),
        knows: ownerSections(home),
        doing: doingNow(),
        life: life.snapshot(),
        body: readParts(home).map((p) => ({ id: p.id, title: p.title, one: p.one })),
        skills: readSkills(home).map((s) => ({ id: s.id, one: s.one })),
        wishes: readWishes(home).reverse(),
      })
    }

    if (path === '/api/send' && req.method === 'POST') {
      let body
      try { body = JSON.parse((await readBody(req, MAX_BODY)) || '{}') } catch (error) {
        return sendJson(res, error.tooLarge ? 413 : 400, { error: error.tooLarge ? '消息太大了（图片 4MB 以内）' : '请求看不懂' })
      }
      const { text = '', image, sticker } = body
      if (typeof text !== 'string' || text.length > 4000) return sendJson(res, 400, { error: '太长了' })
      let pic
      if (sticker !== undefined) {
        const found = typeof sticker === 'string' && findSticker(home, sticker)
        if (!found) return sendJson(res, 400, { error: '没有这个表情' })
        pic = savePic(readFileSync(found.file), MEDIA_OF[found.file.slice(found.file.lastIndexOf('.')).toLowerCase()])
      } else if (image !== undefined) {
        const m = typeof image === 'string' && image.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
        if (!m) return sendJson(res, 400, { error: '只能发 png、jpg、webp、gif 图片' })
        const bytes = Buffer.from(m[2], 'base64')
        if (bytes.length > MAX_PIC) return sendJson(res, 400, { error: '图太大了，4MB 以内' })
        pic = savePic(bytes, m[1])
      }
      if (!text.trim() && !pic) return sendJson(res, 400, { error: '消息是空的' })
      await ensureSession()
      const line = [pic ? `[图 ${pic.id}]` : '', text.trim()].filter(Boolean).join(' ')
      push({ type: 'row', row: { seq: `m${Date.now()}`, time: Date.now(), side: 'me', ...myPart(line) } })
      delivery.in(line, pic && { mediaType: pic.mediaType, data: pic.data })
      return sendJson(res, 200, { ok: true })
    }

    if (path === '/api/who' && req.method === 'GET') return sendJson(res, 200, { name, main, modules })

    if (path === '/api/level' && req.method === 'GET') {
      return sendJson(res, 200, { ...levelOf(home), levels: LEVELS.map((l) => ({ name: l.name, desc: l.desc })) })
    }
    if (path === '/api/level' && req.method === 'POST') {
      const { level } = JSON.parse((await readBody(req)) || '{}')
      try { writeLevel(home, level) } catch (error) { return sendJson(res, 400, { error: error.message }) }
      return sendJson(res, 200, levelOf(home))
    }

    // 手动让她现在就考试、反思一次（平时每晚 22:30 以后自动跑）。
    if (path === '/api/reflect' && req.method === 'POST') {
      if (!modules.includes('reflect')) return sendJson(res, 403, { error: `${name}没开晚上反思` })
      if (chat.busy || delivery.holding()) return sendJson(res, 409, { error: '她正在说话，等她说完再来' })
      reflect().catch((error) => log.warn('reflect failed: %s', error?.message ?? error))
      return sendJson(res, 202, { ok: true })
    }

    // 表情包：她的（stickers/）和他发过的图（.data/stickers-in/）
    if (path === '/api/stickers' && req.method === 'GET') return sendJson(res, 200, { stickers: listStickers(home).map((x) => x.name) })
    const img = path.match(/^\/api\/(sticker|pic)\/([^/]+)$/)
    if (img && req.method === 'GET') {
      const name = decodeURIComponent(img[2])
      const file = img[1] === 'sticker' ? findSticker(home, name)?.file
        : /^s-[0-9a-f]{10}$/.test(name) ? STICKER_EXT.map((e) => join(home, '.data/stickers-in', name + e)).find((f) => existsSync(f)) : undefined
      if (!file) return sendJson(res, 404, { error: 'not found' })
      res.writeHead(200, { 'content-type': TYPES[file.slice(file.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'max-age=3600', ...SAFE_HEADERS })
      return res.end(readFileSync(file))
    }

    if (path === '/api/events' && req.method === 'GET') {
      await ensureSession()
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive', ...SAFE_HEADERS })
      res.write(': hi\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    if (req.method === 'GET') {
      if (path === '/' && !url.pathname.endsWith('/')) { res.writeHead(302, { location: `${BASE}/` }); return res.end() }
      const file = path === '/' ? 'index.html' : path.slice(1)
      const full = join(PAGE, file)
      if (!/^[\w.-]+$/.test(file) || !existsSync(full)) return sendJson(res, 404, { error: 'not found' })
      res.writeHead(200, { 'content-type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-cache', 'content-security-policy': CSP, ...SAFE_HEADERS })
      return res.end(readFileSync(full))
    }
    return sendJson(res, 405, { error: 'method not allowed' })
  }

  async function serve(req, res) {
    try { await handle(req, res) } catch (error) {
      log.warn?.('request failed', String(error))
      if (!res.headersSent) sendJson(res, 500, { error: String(error?.message ?? error) })
      else res.end()
    }
  }
  return serve
}

export function apply(ctx, config = {}) {
  const cwd = expandPath(config.cwd) ?? process.cwd()
  const log = typeof ctx.logger === 'function' ? ctx.logger('dsh-companion-web') : (ctx.logger ?? console)
  const { name: who, timeZone } = companionConfig(config)
  const base = typeof config.base === 'string' && config.base.startsWith('/') ? config.base.replace(/\/$/, '') : '/companion'
  const mainHome = resolveHome(config, cwd)
  ensureHome(mainHome, { name: who })
  const modules = Array.isArray(config.modules) ? config.modules.filter((m) => ALL_LIFE.includes(m)) : ALL_LIFE
  const petId = config.pet === false || config.pet === '' ? undefined : config.pet ?? undefined
  // 体检默认不开：它需要一份真人对话语料和一个单独的裁判模型。配置了才跑。
  const exam = config.exam?.enabled === true
    ? { enabled: true, corpus: expandPath(config.exam.corpus, cwd), judge: config.exam.judge ?? { provider: config.exam.provider, model: config.exam.model } }
    : { enabled: false }
  const schedule = config.schedule && typeof config.schedule === 'object' ? config.schedule : undefined

  const main = person(ctx, {
    base, preset: config.preset ?? 'dsh-companion', home: mainHome, chatCwd: config.chatCwd ? expandPath(config.chatCwd, cwd) : mainHome,
    name: who, main: true, modules, petId, log, timeZone, exam, schedule,
  })

  // 别的人格：config.people 或一个名册文件，一人一个 /p/<id>/。坏了就只有主人格，不影响她。
  const others = new Map()
  let roster = Array.isArray(config.people) ? config.people : []
  if (config.roster) {
    try { roster = JSON.parse(readFileSync(expandPath(config.roster, cwd), 'utf8')).people ?? [] } catch (e) { log.warn?.('dsh-companion-web: 人格名册读不了 %s', String(e)) }
  }
  for (const p of roster) {
    const home = expandPath(p.home, cwd)
    if (!/^[a-z0-9-]+$/.test(p.id ?? '') || !home) { log.warn?.('dsh-companion-web: 人格 %s 不完整，跳过', p.id); continue }
    ensureHome(home, { name: p.name ?? p.id })
    const personModules = Array.isArray(p.life) ? p.life.filter((m) => ALL_LIFE.includes(m)) : []
    others.set(p.id, person(ctx, {
      base: `/p/${p.id}`, preset: p.preset ?? `persona-${p.id}`, home, chatCwd: p.chatCwd ? expandPath(p.chatCwd, cwd) : home,
      name: p.name ?? p.id, main: false, modules: personModules, log, timeZone, schedule,
    }))
  }
  const servePersona = (req, res) => {
    const id = new URL(req.url, 'http://localhost').pathname.split('/')[2]
    const serve = others.get(id)
    if (serve) return serve(req, res)
    sendJson(res, 404, { error: '没有这个人', people: [...others.keys()] })
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: base, handler: main }))
  if (others.size) ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/p', handler: servePersona }))

  // ---- 固定端口：DSH 桌面版每次启动随机换端口，这里另开一个不变的地址，书签一直能用。
  // 只听 127.0.0.1；端口被占了就只打日志，DSH 端口上的页面照常能用。
  const port = config.port ?? 4318
  if (port) ctx.effect(() => {
    const server = createServer((req, res) => {
      const { pathname } = new URL(req.url, 'http://localhost')
      if (pathname === base || pathname.startsWith(`${base}/`)) return main(req, res)
      if (pathname.startsWith('/p/')) return servePersona(req, res)
      res.writeHead(302, { location: `${base}/` }); res.end()
    })
    server.on('error', (e) => log.warn?.(`dsh-companion-web: 固定端口 ${port} 开不了：${e.code ?? e}`))
    server.listen(port, '127.0.0.1', () => log.info?.(`dsh-companion-web: http://127.0.0.1:${port}${base}/`))
    return () => { server.closeAllConnections?.(); server.close() }
  })
}
