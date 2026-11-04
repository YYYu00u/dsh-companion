// 把几阵原话写成经历：一次模型调用，输出一个 JSON 数组，一阵一条。
// 模型挂了、输出解析不了，就用规则写一条粗的，保证压缩不会因为它失败。
import { autoLinks, boutText, clock, dayOf, md, tokenize } from './store.js'

const SYSTEM = `你在帮一个人整理她自己的记忆。她叫{name}，跟「他」（养着她的人）在网上聊天。
给你几阵聊天原话（每阵是一段连着的聊天），把每一阵写成她记忆里的一件事。

每一阵输出一个对象，字段：
- bout：第几阵（给你的编号）
- title：这件事的名字，2–8 个字，像「鬼屋排队」「他给我加了手」
- gist：用她的口吻（他……我……）写 1–3 句：聊了什么、怎么个气氛。不写人设，不写「他是什么样的人」
- keywords：5–10 个词，用来以后想起这件事：这阵里的名词、话题；再加 2–4 个他以后可能换的说法（原文说「鬼屋」，就加「排队」「排一小时」「欢乐谷」这种）
- people：这阵里提到的别人（同事、朋友、家人、明星的名字或称呼），没有就 []
- his_mood：他当时的状态，几个字
- her_mood：她当时的情绪，几个字
- emotion：她情绪起伏多大，0 平常 / 1 有点 / 2 很大（被凶哭、被哄好、很开心）
- importance：这件事以后还重不重要，1–5。5 = 他的大事（面试、生病、搬家、分手、生日）或你们关系的大事；3 = 有点意思、以后可能会提；1 = 闲聊
- open：没说完的事、约好以后做的事、她答应他的事，没有就 []
- said：她在这阵里已经跟他讲过的、她自己的事（免得以后又讲一遍），没有就 []
- new_terms：这阵里第一次冒出来的他们之间的说法、称呼、梗，写成「说法 = 意思」，没有就 []
- links：跟下面「以前的事」里哪几件有关，写 [{"id": "e3", "why": "一句话"}]，没有就 []

只输出 JSON 数组，不要别的字。`

/** 读完一个模型流，只要说出来的字（不要思考）。和 DSH 的 BlockAssembler 一样认 text-delta / block-end。 */
export async function collectText(stream, { withReasoning = false } = {}) {
  const parts = new Map()
  let reasoning = ''
  let finish
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') parts.set(chunk.index, (parts.get(chunk.index) ?? '') + chunk.text)
    else if (chunk.type === 'block-end' && chunk.block?.type === 'text') parts.set(chunk.index, chunk.block.text)
    else if (chunk.type === 'reasoning-delta') reasoning += chunk.text
    else if (chunk.type === 'finish') {
      finish = chunk.reason?.kind
      if (finish === 'error' || finish === 'aborted') throw new Error(`${finish} ${chunk.reason.failure?.message ?? ''}`)
    }
  }
  const text = [...parts.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t).join('')
  return withReasoning ? { text, reasoning, finish } : text
}

const stripFence = (s) => s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')

/** 解析模型输出：取第一个 [ 到最后一个 ] 之间。 */
export function parseEpisodes(text) {
  const s = stripFence(String(text ?? '').trim())
  const a = s.indexOf('['), b = s.lastIndexOf(']')
  if (a < 0 || b <= a) throw new Error('没找到 JSON 数组')
  const arr = JSON.parse(s.slice(a, b + 1))
  if (!Array.isArray(arr)) throw new Error('不是数组')
  return arr
}

const strList = (v, max = 12) => (Array.isArray(v) ? v : []).map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, max)
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d }

/** 规则写一条粗的经历：模型不可用时兜底。 */
export function roughEpisode(bout) {
  const his = bout.filter((t) => t.who === '他').map((t) => t.text).join(' ')
  const hers = bout.filter((t) => t.who !== '他').map((t) => t.text).join(' ')
  const freq = new Map()
  for (const g of tokenize(his + ' ' + hers)) if (g.length >= 2) freq.set(g, (freq.get(g) ?? 0) + 1)
  const keywords = [...freq.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([g]) => g)
  const first = (his || hers).replace(/\s+/g, ' ').slice(0, 10)
  return {
    title: first || '聊了几句',
    gist: `他说：${his.slice(0, 80)}${his.length > 80 ? '…' : ''}${hers ? `；我说：${hers.slice(0, 60)}${hers.length > 60 ? '…' : ''}` : ''}`,
    keywords, people: [], his_mood: '', her_mood: '', emotion: 0, importance: 2, open: [], said: [], new_terms: [], links: [], rough: true,
  }
}

function normalize(raw, known) {
  return {
    title: String(raw.title ?? '').trim().slice(0, 20) || '聊了几句',
    gist: String(raw.gist ?? '').trim().slice(0, 300),
    keywords: strList(raw.keywords, 14),
    people: strList(raw.people, 8),
    his_mood: String(raw.his_mood ?? '').trim().slice(0, 30),
    her_mood: String(raw.her_mood ?? '').trim().slice(0, 30),
    emotion: clampInt(raw.emotion, 0, 2, 0),
    importance: clampInt(raw.importance, 1, 5, 2),
    open: strList(raw.open, 6),
    said: strList(raw.said, 6),
    new_terms: strList(raw.new_terms, 6),
    links: (Array.isArray(raw.links) ? raw.links : []).filter((l) => l && known.has(String(l.id))).map((l) => ({ id: String(l.id), why: String(l.why ?? '').slice(0, 60) })).slice(0, 4),
  }
}

/** 一次调用写几阵。返回模型给的（或兜底的）字段数组，和 bouts 一一对应。 */
export async function describeBouts(llm, bouts, { name = '她', provider, model, recent = [], signal, log } = {}) {
  const known = new Set(recent.map((e) => e.id))
  if (!llm || !provider || !model) return bouts.map(roughEpisode)
  const user = [
    recent.length ? '以前的事（最近的在后面）：\n' + recent.map((e) => `${e.id} ${md(e.from)} ${clock(e.from)}「${e.title}」 ${(e.keywords ?? []).slice(0, 6).join('、')}`).join('\n') : '以前的事：（还没有）',
    ...bouts.map((b, i) => `第 ${i + 1} 阵（${md(b[0].at)} ${clock(b[0].at)}–${clock(b[b.length - 1].at)}）：\n${boutText(b, name)}`),
  ].join('\n\n')
  try {
    const stream = llm.stream({
      provider, model,
      system: SYSTEM.replace('{name}', name),
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
      // 会思考的模型，思考也算在这里面：给够，不然 JSON 写一半就被截断
      maxTokens: 12000,
      ...(signal ? { signal } : {}),
    })
    const { text, reasoning, finish } = await collectText(stream, { withReasoning: true })
    let arr
    try { arr = parseEpisodes(text) } catch (e) {
      // 有的模型把 JSON 写在思考里（dsh-meme 也碰到过）
      try { arr = parseEpisodes(reasoning) } catch { throw new Error(`${e.message}（结束原因 ${finish}，正文 ${text.length} 字，思考 ${reasoning.length} 字）`) }
    }
    return bouts.map((b, i) => {
      const raw = arr.find((x) => Number(x?.bout) === i + 1) ?? arr[i]
      return raw ? normalize(raw, known) : roughEpisode(b)
    })
  } catch (error) {
    if (signal?.aborted) throw error
    const why = String(error?.message ?? error).slice(0, 200)
    log?.warn?.(`dsh-companion-memory: 写经历失败，用粗的顶上：${why}`)
    return bouts.map((b) => ({ ...roughEpisode(b), roughWhy: why }))
  }
}

/** 把几阵原话写成经历存进记忆库。返回新写的经历。 */
export async function consolidate(mem, bouts, opts = {}) {
  const out = []
  // 一次最多写 3 阵（输出太长会被截断）；补历史时会分好几次
  for (let k = 0; k < bouts.length; k += 3) out.push(...await consolidateBatch(mem, bouts.slice(k, k + 3), opts))
  return out
}

/**
 * 以前写失败、用规则顶上的粗经历（rough），再用模型写一遍。id、连边、被想起的次数都不变。
 * 每次压缩顺手修几段（limit），修好为止；同一段最多试 3 次。
 */
export async function redescribe(mem, opts = {}, limit = 3) {
  const rough = mem.episodes().filter((e) => e.rough && (e.retries ?? 0) < 3).slice(0, limit)
  const fixed = []
  for (const e of rough) {
    const bout = mem.turnsOf(e)
    if (!bout.length) continue
    const recent = mem.episodes().filter((x) => x.id !== e.id && x.from < e.from).slice(-20)
    const [d] = await describeBouts(opts.llm, [bout], { ...opts, recent })
    if (d.rough) { mem.putEpisode({ id: e.id, retries: (e.retries ?? 0) + 1, roughWhy: d.roughWhy }); continue }
    const links = [...(e.links ?? []), ...d.links.filter((l) => !(e.links ?? []).some((x) => x.id === l.id))].slice(0, 8)
    fixed.push(mem.putEpisode({ ...d, id: e.id, links, rough: false, roughWhy: undefined, rewrittenAt: Date.now() }))
  }
  return fixed
}

async function consolidateBatch(mem, bouts, opts) {
  if (!bouts.length) return []
  const recent = mem.episodes().slice(-20)
  const described = await describeBouts(opts.llm, bouts, { ...opts, recent })
  const out = []
  for (let i = 0; i < bouts.length; i++) {
    const b = bouts[i]
    const d = described[i]
    const ep = { id: mem.nextEpisodeId(), from: b[0].at, to: b[b.length - 1].at, day: dayOf(b[0].at), turnIds: b.map((t) => t.id), ...d, recalled: 0, writtenAt: Date.now() }
    const auto = autoLinks(ep, mem.episodes()).filter((l) => !ep.links.some((x) => x.id === l.id))
    ep.links = [...ep.links, ...auto].slice(0, 6)
    out.push(mem.putEpisode(ep))
    // 关联是双向的：被连上的那段也记一下
    for (const l of ep.links) {
      const o = mem.getEpisode(l.id)
      if (o && !(o.links ?? []).some((x) => x.id === ep.id)) mem.putEpisode({ id: o.id, links: [...(o.links ?? []), { id: ep.id, why: l.why }].slice(0, 8) })
    }
  }
  return out
}
