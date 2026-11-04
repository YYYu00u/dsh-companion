// 记忆在聊天这一侧做的事（挂在她的 preset 里，跟本子、心情一起）：
// 1. 原话档案：她的会话里每多一句他说的、她说的，就追加到 .data/memory/turns.jsonl。
// 2. 每轮想起来：用他刚说的这句当线索，从中期记忆（经历）里找 2–3 段，放进背景。0 次模型调用。
// 3. look_back：翻出某段经历的原话。
// 写经历在压缩那一侧（compact.js）。
import { BYE_RE, clock, dayOf, episodeLine, memPaths, openMemory } from './store.js'

const textOf = (content) => (content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
const NUDGE = '（旁白）'
const PIC_TAG = /\[图 (s-[0-9a-f]{10})\]/

/** 一个会话事件 → 一句原话；不是原话（旁白、背景、思考、工具）就返回 undefined。 */
export function turnOf(event, sessionId) {
  const key = `${String(sessionId).slice(-8)}:${event.seq}`
  if (event.type === 'user/message' && event.data?.source?.kind === 'user') {
    const text = textOf(event.data.content)
    if (!text || text.startsWith(NUDGE)) return undefined
    const pic = text.match(PIC_TAG)?.[1]
    return { key, msgId: event.data.id, at: event.time, who: '他', text: text.replace(PIC_TAG, '').trim(), ...(pic ? { pic } : {}) }
  }
  if (event.type === 'assistant/message') {
    const text = textOf(event.data?.message?.content)
    if (!text || /^\s*\[沉默\]\s*$/.test(text)) return undefined
    return { key, msgId: event.data.message.id, at: event.time, who: '她', text }
  }
  return undefined
}

/** 他这句值不值得去想：「嗯」「哈哈」「晚安」这种不想。 */
export function worthRecalling(text) {
  const t = String(text ?? '').replace(/\s+/g, '')
  if (t.length < 4) return false
  if (/^[嗯哦哈呵好行对噢啊额呃诶欸~～!！?？。.…]+$/.test(t)) return false
  return !BYE_RE.test(t)
}

export function registerMemory(ctx, home, { name = '她' } = {}) {
  const mem = openMemory(home)
  const upTo = new WeakMap() // 每个会话记到第几个事件了

  // ---- 1. 原话档案：听自己这个 preset 里的会话（agent 是这个 preset 建的才算）。
  // 第一次见到一个会话，先把它已有的事件补一遍（重启后、或者补历史）；之后每来一个事件记一句。
  // 每步开始、拼背景的时候都从上次记到的地方往后扫一遍，不靠事件通知（插件在 preset 里，通知不一定收得到）。
  const archive = (session) => {
    if (!session?.snapshotEvents) return
    const from = upTo.get(session) ?? 0
    const events = session.snapshotEvents()
    for (let i = from; i < events.length; i++) { const t = turnOf(events[i], session.id); if (t) mem.addTurn(t) }
    upTo.set(session, events.length)
  }
  // 他刚发来的这句，在背景生成的时候还没进会话（DSH 先拼背景、再把他的话放进去），所以在这里先记下当线索。
  const cues = new WeakMap()
  ctx.on('agent/pre-step', async (payload, next) => {
    const session = payload.agent?.session
    archive(session)
    const his = [...(payload.messages ?? [])].reverse().find((m) => m.source?.kind === 'user' && !textOf(m.content).startsWith(NUDGE))
    if (session && his) cues.set(session, { id: his.id, text: textOf(his.content).replace(PIC_TAG, '').trim() })
    return next()
  })
  // 她说完一句：这一轮结束时也扫一遍，这样不等下一句话，她刚说的就进档案了。
  ctx.on('agent/turn-stopping', async (payload) => { try { archive(payload.agent?.session) } catch {} })

  // ---- 2. 每轮想起来：用他最近说的一句当线索。眼前已经有的（聊天历史里的原话、压缩留下的检查点里列的）不再拿。
  let cache = { key: '', text: '' }
  ctx.systemPrompt.context({
    name: 'dsh-companion:memory',
    order: 320,
    interpolate: false,
    required: true,
    text: (c) => {
      const session = c.agent?.session
      if (session) archive(session)
      const last = (session && cues.get(session)) ?? [...mem.turns].reverse().find((t) => t.who === '他')
      const cue = last && worthRecalling(last.text) ? last.text : ''
      if (!cue) return ''
      const eps = mem.episodes()
      const key = `${eps.length}|${cue}|${last.id}`
      if (key === cache.key) return cache.text
      const now = Date.now()
      const exclude = new Set(session ? inView(session, mem) : [])
      const found = mem.search(cue, { exclude, now })
      if (found.length) mem.noteRecalled(found.map((x) => x.e.id), cue, now)
      cache = {
        key,
        text: found.length
          ? `他刚说的让你想起来的（自然地用，别说「我记得」「你上次说」；想不起细节就别编，可以用 look_back 翻原话）：\n${found.map((x) => episodeLine(x.e, { now }) + (x.r < 0.3 ? '（印象已经有点模糊了）' : '')).join('\n')}`
          : '',
      }
      return cache.text
    },
  })

  // ---- 3. look_back：翻原话
  const out = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }
  ctx.tools.register({
    name: 'look_back',
    description: '翻你们以前聊天的原话。他问「你那天怎么说的」「我们上次聊的那个」、你想不起细节的时候用。query 写几个关键词（人名、地方、那件事）；知道是哪天就加 day（YYYY-MM-DD）。会找到最像的那一段，给你那段的原话。',
    parameters: { type: 'object', properties: { query: { type: 'string' }, day: { type: 'string' } }, required: ['query'], additionalProperties: false },
    output: { schema: out, render: (_a, v) => [{ type: 'text', text: v.text }] },
    async execute(args) { return { text: lookBack(mem, args ?? {}, name) } },
  })
  return mem
}

/** 眼前已经有的经历：原话还在聊天历史里的、压缩检查点里列着的。 */
function inView(session, mem) {
  const ids = new Set()
  const live = new Set()
  for (const seq of session.surface.nodes) {
    const e = session.eventAt(seq)
    if (e?.type === 'user/message') {
      live.add(e.data.id)
      if (e.data.source?.kind === 'compact-checkpoint') for (const id of mem.checkpointIds(e.data)) ids.add(id)
    } else if (e?.type === 'assistant/message') live.add(e.data.message?.id)
  }
  for (const ep of mem.episodes()) if (mem.turnsOf(ep).some((t) => live.has(t.msgId))) ids.add(ep.id)
  return ids
}

export function lookBack(mem, { query, day }, name = '她') {
  const q = String(query ?? '').trim()
  if (!q) throw new Error('query 写你想找的事，几个关键词就行')
  let hits = mem.search(q, { limit: 2, minRelevance: 0.2, forgetBelow: 0, follow: 0 })
  if (day) hits = [...mem.episodes().filter((e) => e.day === day).map((e) => ({ e })), ...hits].filter((x, i, a) => a.findIndex((y) => y.e.id === x.e.id) === i).slice(0, 2)
  if (hits.length) {
    mem.noteRecalled(hits.map((x) => x.e.id), q)
    return hits.map(({ e }) => {
      const turns = mem.turnsOf(e).slice(0, 30)
      return `「${e.title}」${e.day} ${clock(e.from)}–${clock(e.to)}\n${turns.map((t) => `${clock(t.at)} ${t.who === '他' ? '他' : name}：${t.text}`).join('\n')}`
    }).join('\n\n')
  }
  // 还没写成经历的（今天的、或者补进来还没整理的）：直接在原话里找
  const words = q.split(/\s+/).filter(Boolean)
  const raw = mem.turns.filter((t) => (!day || dayOf(t.at) === day) && words.some((w) => t.text.includes(w))).slice(-12)
  if (raw.length) return raw.map((t) => `${dayOf(t.at)} ${clock(t.at)} ${t.who === '他' ? '他' : name}：${t.text}`).join('\n')
  return '没翻到。可能没聊过，或者换个说法再找一次。'
}

export { memPaths }
