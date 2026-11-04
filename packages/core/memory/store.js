// 她的记忆：原话档案、一段段的经历、检索。都是她家里 .data/memory/ 下的普通文件，不依赖 DSH。
// - 原话档案 turns.jsonl：他说的、她说的，一行一句，只追加不删。
// - 经历 episodes.jsonl：压缩时把被压掉的原话按「隔 30 分钟」切成几段，每段写成一条经历（中期记忆）。
// - 检索：中文两个字一组（二元字）建倒排表，BM25 打分；再乘上遗忘曲线和重要度；顺着关联多带一段。
// 原理和取舍见 research/reviews/memory-design.md 第 3、7、8 节。
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const GAP_MS = 30 * 60_000
// 他要走了（和 web 的 senses.js 的 BYE 一样）：这种话不拿去想事情。
export const BYE_RE = /^.{0,12}(晚安|睡了|睡觉了|去睡了|拜拜|88|下了|下线了|先走了|去忙了|忙去了|先这样|回头聊|明天聊)[啦了吧哈呀~～!！。.\s]*$/
export const DAY_START_HOUR = 4
const DAY_MS = 86400_000

export const memPaths = (home) => ({
  dir: join(home, '.data/memory'),
  turns: join(home, '.data/memory/turns.jsonl'),
  episodes: join(home, '.data/memory/episodes.jsonl'),
  recalls: join(home, '.data/memory/recalls.jsonl'),
  checkpoints: join(home, '.data/memory/checkpoints.jsonl'),
})

function readLines(file) {
  try { return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return undefined } }).filter(Boolean) } catch { return [] }
}
function appendLine(file, obj) {
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8')
}

/** 「她的一天」从凌晨 4 点算起：23:50 到 00:10 是同一晚。 */
export function dayOf(at) {
  const d = new Date(at - DAY_START_HOUR * 3600_000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const clock = (at) => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const md = (at) => { const d = new Date(at); return `${d.getMonth() + 1}-${d.getDate()}` }

// ---------------- 原话档案

/** 一个记忆库：一个家一个。turns / episodes 在内存里各一份，写的时候同时追加到文件。 */
// 同一个家只开一份：聊天插件（存原话、想起来）和压缩插件（写经历）共用，免得两份内存对不上。
const opened = new Map()
export function openMemory(home) {
  if (!opened.has(home)) opened.set(home, open(home))
  return opened.get(home)
}
/** 测试用：丢掉缓存，下次重新从文件读。 */
export function closeMemory(home) { opened.delete(home) }

function open(home) {
  const p = memPaths(home)
  const turns = readLines(p.turns)
  const byKey = new Set(turns.map((t) => t.key).filter(Boolean))
  const episodes = readLines(p.episodes)
  // 同一段可能被改写（被想起次数、强度变了）：后写的覆盖先写的，按 id 取最后一条。
  const epById = new Map()
  for (const e of episodes) epById.set(e.id, { ...epById.get(e.id), ...e })
  let index = buildIndex([...epById.values()])
  // 压缩留下的检查点里列了哪几段经历：检查点再被压一次时要带上它们；想起来时不重复拿它们。
  const checkpoints = new Map(readLines(p.checkpoints).map((c) => [c.text, c.ids]))

  const mem = {
    home,
    paths: p,
    turns,
    episodes: () => [...epById.values()].sort((a, b) => a.from - b.from),

    /**
     * 记一句原话。key 是「会话尾号:事件号」，同一句只记一次（重启、补历史都不会重复）。
     * msgId 是 DSH 消息的 id，压缩时用它认出被压掉的是哪几句。
     */
    addTurn(t) {
      if (!t.text?.trim() && !t.pic) return undefined
      if (t.key && byKey.has(t.key)) return undefined
      const row = { id: `t${turns.length + 1}`, at: t.at ?? Date.now(), who: t.who, text: t.text?.trim() ?? '', ...(t.pic ? { pic: t.pic } : {}), ...(t.key ? { key: t.key } : {}), ...(t.msgId ? { msgId: t.msgId } : {}) }
      turns.push(row)
      if (row.key) byKey.add(row.key)
      appendLine(p.turns, row)
      return row
    },
    hasKey: (key) => byKey.has(key),

    /** 存一段经历（新的或改过的）。 */
    putEpisode(ep) {
      const merged = { ...epById.get(ep.id), ...ep }
      epById.set(ep.id, merged)
      appendLine(p.episodes, merged)
      index = buildIndex([...epById.values()])
      return merged
    },
    getEpisode: (id) => epById.get(id),
    nextEpisodeId: () => `e${epById.size + 1}`,

    /** 某段经历对应的原话。 */
    turnsOf(ep) {
      const ids = new Set(ep.turnIds ?? [])
      return turns.filter((t) => ids.has(t.id) || (!ids.size && t.at >= ep.from && t.at <= ep.to))
    },

    /** 已经写进某段经历的原话 id。 */
    coveredTurnIds() {
      const s = new Set()
      for (const e of epById.values()) for (const id of e.turnIds ?? []) s.add(id)
      return s
    },

    rememberCheckpoint(text, ids) {
      if (checkpoints.has(text)) return
      checkpoints.set(text, ids)
      appendLine(p.checkpoints, { at: Date.now(), text, ids })
    },
    /** 一条消息（检查点）里列了哪几段经历。 */
    checkpointIds(message) {
      const out = []
      for (const b of message?.content ?? []) if (b.type === 'text' && checkpoints.has(b.text)) out.push(...checkpoints.get(b.text))
      return out
    },

    search: (query, opts) => searchEpisodes(index, [...epById.values()], query, opts),

    /**
     * 这几段被想起来了：次数 +1、记下时间（遗忘曲线从这一刻重新算，牢固度也变大）。
     * 同一段 10 分钟里只算一次，免得一轮里调工具的几步把次数刷上去。
     */
    noteRecalled(ids, cue, now = Date.now()) {
      for (const id of ids) {
        const e = epById.get(id)
        if (!e || now - (e.lastRecalled ?? 0) < 10 * 60_000) continue
        mem.putEpisode({ id, recalled: (e.recalled ?? 0) + 1, lastRecalled: now })
        appendLine(p.recalls, { at: now, id, cue: String(cue ?? '').slice(0, 80) })
      }
    },
  }
  return mem
}

// ---------------- 切段

/** 按「隔 30 分钟 / 跨天 / 满 maxTurns 条」把一串原话切成几阵。 */
export function splitIntoBouts(turns, { gapMs = GAP_MS, maxTurns = 40 } = {}) {
  const bouts = []
  let cur = []
  for (const t of [...turns].sort((a, b) => a.at - b.at)) {
    const last = cur[cur.length - 1]
    if (last && (t.at - last.at >= gapMs || dayOf(t.at) !== dayOf(last.at) || cur.length >= maxTurns)) { bouts.push(cur); cur = [] }
    cur.push(t)
  }
  if (cur.length) bouts.push(cur)
  return bouts
}

/** 一阵原话写成给模型看的文字。 */
export function boutText(bout, name = '她') {
  return bout.map((t) => `${clock(t.at)} ${t.who === '他' ? '他' : name}：${t.text}${t.pic ? '[图]' : ''}`).join('\n')
}

// ---------------- 检索

const STOP = new Set(['我们', '你们', '他们', '什么', '怎么', '这个', '那个', '一个', '没有', '就是', '还是', '可以', '不是', '知道', '现在', '今天', '真的', '一下', '有点', '然后', '因为', '所以', '但是', '的话', '哈哈'])

/** 切词：中文按两个字一组，英文和数字按整个词；全转小写。 */
export function tokenize(text) {
  const out = []
  const s = String(text ?? '').toLowerCase()
  for (const m of s.matchAll(/[a-z0-9]+(?:[-_.][a-z0-9]+)*|[\u4e00-\u9fff]+/g)) {
    const w = m[0]
    if (/^[a-z0-9]/.test(w)) { if (w.length >= 2 || /\d/.test(w)) out.push(w); continue }
    if (w.length === 1) { out.push(w); continue }
    for (let i = 0; i + 1 < w.length; i++) { const g = w.slice(i, i + 2); if (!STOP.has(g)) out.push(g) }
  }
  return out
}

/** 一段经历拿来检索的文字：标题、经过、关键词（含换说法）、没说完的事、提到的人。关键词算两遍，权重高一点。 */
const docText = (e) => [e.title, e.gist, ...(e.keywords ?? []), ...(e.keywords ?? []), ...(e.open ?? []), ...(e.people ?? []), ...(e.people ?? [])].filter(Boolean).join(' ')

function buildIndex(episodes) {
  const docs = new Map()
  const df = new Map()
  let total = 0
  for (const e of episodes) {
    const toks = tokenize(docText(e))
    const tf = new Map()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    docs.set(e.id, { tf, len: toks.length })
    total += toks.length
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  }
  return { docs, df, n: episodes.length, avg: episodes.length ? total / episodes.length : 1 }
}

function bm25(index, query) {
  const k1 = 1.2, b = 0.75
  const q = [...new Set(tokenize(query))]
  const scores = new Map()
  for (const [id, d] of index.docs) {
    let s = 0
    for (const t of q) {
      const f = d.tf.get(t)
      if (!f) continue
      const n = index.df.get(t) ?? 0
      const idf = Math.log(1 + (index.n - n + 0.5) / (n + 0.5))
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / index.avg))
    }
    if (s > 0) scores.set(id, s)
  }
  return scores
}

/**
 * 记得的程度：e^(−过了几天 / S)。S 是牢固度（天）：
 * 起点看重要度（1–5）和情绪强度（0–2），每被想起一次加 2 天。重要度 5 的事几乎不掉。
 */
export function strengthOf(e) {
  return 2 + 1.5 * (e.importance ?? 2) + 2 * (e.emotion ?? 0) + 2 * (e.recalled ?? 0) + ((e.importance ?? 0) >= 5 ? 60 : 0)
}
export function retention(e, now = Date.now()) {
  const days = Math.max(0, now - (e.lastRecalled ?? e.to ?? e.from)) / DAY_MS
  return Math.exp(-days / strengthOf(e))
}

/**
 * 按线索找经历。分数 = 相关度 + 0.5 × 记得的程度 + 0.3 × 重要度/5。
 * - exclude：不要的段（当前这段、今天已经在请求里的）
 * - minRelevance：相关度（归一到 0–1）低于这个的不要
 * - forgetBelow：记得的程度低于这个的，自动想起时不要（明确去翻时传 0）
 * - follow：顺着关联多带几段
 */
export function searchEpisodes(index, episodes, query, { limit = 3, exclude = new Set(), minRelevance = 0.3, forgetBelow = 0.05, follow = 1, now = Date.now() } = {}) {
  const raw = bm25(index, query)
  if (!raw.size) return []
  const top = Math.max(...raw.values())
  const byId = new Map(episodes.map((e) => [e.id, e]))
  const scored = []
  for (const [id, s] of raw) {
    const e = byId.get(id)
    if (!e || exclude.has(id)) continue
    const rel = s / top
    const r = retention(e, now)
    if (rel < minRelevance || r < forgetBelow) continue
    scored.push({ e, rel, r, score: rel + 0.5 * r + 0.3 * (e.importance ?? 2) / 5 })
  }
  scored.sort((a, b) => b.score - a.score)
  const picked = scored.slice(0, limit)
  // 顺着关联带出前因后果：取到的段连着的、还没取到的、记得的程度不太低的，加 follow 段。
  const have = new Set(picked.map((x) => x.e.id))
  const linked = []
  for (const x of picked) {
    for (const l of x.e.links ?? []) {
      const e = byId.get(l.id)
      if (!e || have.has(e.id) || exclude.has(e.id) || retention(e, now) < forgetBelow) continue
      have.add(e.id)
      linked.push({ e, rel: (raw.get(e.id) ?? 0) / top, r: retention(e, now), via: x.e.id, why: l.why })
    }
  }
  return [...picked, ...linked.slice(0, follow)]
}

/** 一段经历写成一行，给她看。 */
export function episodeLine(e, { now = Date.now() } = {}) {
  const when = dayOf(e.from) === dayOf(now) ? `今天 ${clock(e.from)}` : `${md(e.from)} ${clock(e.from)}`
  const open = e.open?.length ? `（还没兑现：${e.open.join('；')}）` : ''
  return `- ${when}「${e.title}」${e.gist}${open}`
}

/** 两段之间自动连边：关键词或提到的人有 2 个以上相同。 */
export function autoLinks(ep, others) {
  const mine = new Set([...(ep.keywords ?? []), ...(ep.people ?? [])].map((k) => k.toLowerCase()))
  const out = []
  for (const o of others) {
    if (o.id === ep.id) continue
    const shared = [...(o.keywords ?? []), ...(o.people ?? [])].filter((k) => mine.has(k.toLowerCase()))
    if (new Set(shared).size >= 2) out.push({ id: o.id, why: `都聊到 ${[...new Set(shared)].slice(0, 3).join('、')}` })
  }
  return out
}

export { clock, md }
