// 表情包库：一张图一个文件（文件名是主名字），另外三样信息记在 stickers/ 下的 json 里：
// - aliases.json：同一张图的别的说法 { 主名字: [说法…] }（11-04 去重时加的）
// - meta.json：每张图的意思 { 主名字: { means, tags, text, good, bad, sent, lastSent } }
//   means 是「这张图在回什么、什么时候用、语气多重」，挑图看它，不看文件名（AstrBot meme_manager、dsh-meme、KouriChat 都这么做）
// - .data/stickers/sent.jsonl：每次发了哪张、当时他说了什么，下一句他的反应来了再记好坏
// 设计见 research/reviews/sticker-design.md。
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const STICKER_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
export const STICKER_LINE = /^\[表情[:：]\s*([^\]\n]{1,20})\]$/
// 这么多张以内全列给她看；再多就检索，只给相关的几张
export const LIST_ALL_UP_TO = 20

const dirOf = (home) => join(home, 'stickers')
const aliasFile = (home) => join(dirOf(home), 'aliases.json')
const metaFile = (home) => join(dirOf(home), 'meta.json')
const sentFile = (home) => join(home, '.data/stickers/sent.jsonl')

function readJson(file, fallback) { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback } }
function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, file)
}

export const readAliases = (home) => readJson(aliasFile(home), {})
export const readStickerMeta = (home) => readJson(metaFile(home), {})

/** 全部表情：{ name, file, aliases, means, tags, text, good, bad, sent, lastSent }，按名字排。 */
export function listStickers(home) {
  try {
    const aliases = readAliases(home)
    const meta = readStickerMeta(home)
    return readdirSync(dirOf(home)).filter((f) => STICKER_EXT.some((e) => f.toLowerCase().endsWith(e)))
      .map((f) => {
        const name = f.slice(0, f.lastIndexOf('.'))
        return { name, file: join(dirOf(home), f), aliases: aliases[name] ?? [], ...defaults(meta[name]) }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  } catch { return [] }
}
const defaults = (m = {}) => ({ means: m.means ?? '', tags: m.tags ?? [], text: m.text ?? '', good: m.good ?? 0, bad: m.bad ?? 0, sent: m.sent ?? 0, lastSent: m.lastSent ?? 0 })

/** 按名字找：主名字或者别的说法都行，返回的 name 是主名字。 */
export const findSticker = (home, name) => listStickers(home).find((s) => s.name === name || s.aliases.includes(name))

/** 给一张已有的表情包加一个说法。这个说法已经被占了就不加，返回 false。 */
export function addStickerAlias(home, main, alias) {
  if (!alias || findSticker(home, alias)) return false
  const all = readAliases(home)
  all[main] = [...(all[main] ?? []), alias]
  writeJson(aliasFile(home), all)
  return true
}

/** 改一张图的意思、标签、图里的字（只改给了的）。 */
export function setStickerMeta(home, name, patch) {
  const all = readStickerMeta(home)
  const cur = all[name] ?? {}
  const next = { ...cur }
  if (patch.means !== undefined) next.means = String(patch.means).trim().slice(0, 120)
  if (patch.tags !== undefined) next.tags = (Array.isArray(patch.tags) ? patch.tags : String(patch.tags).split(/[,，、\s]+/)).map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
  if (patch.text !== undefined) next.text = String(patch.text).trim().slice(0, 60)
  for (const k of ['good', 'bad', 'sent', 'lastSent']) if (patch[k] !== undefined) next[k] = patch[k]
  all[name] = next
  writeJson(metaFile(home), all)
  return next
}

/** 改主名字：文件、别名、意思一起挪；旧名字留作说法，以前聊天记录里的 [表情:旧名] 还显示得出来。 */
export function renameSticker(home, from, to) {
  const s = findSticker(home, from)
  if (!s) throw new Error(`没有「${from}」这张`)
  if (s.name === to) return s.name
  if (findSticker(home, to)) throw new Error(`「${to}」已经有了`)
  const dest = join(dirOf(home), to + s.file.slice(s.file.lastIndexOf('.')))
  renameSync(s.file, dest)
  const aliases = readAliases(home)
  aliases[to] = [...new Set([...(aliases[s.name] ?? []), s.name])].filter((a) => a !== to)
  delete aliases[s.name]
  writeJson(aliasFile(home), aliases)
  const meta = readStickerMeta(home)
  if (meta[s.name]) { meta[to] = meta[s.name]; delete meta[s.name]; writeJson(metaFile(home), meta) }
  return to
}

// ---------------- 检索

const STOP = new Set(['我们', '你们', '他们', '什么', '怎么', '这个', '那个', '一个', '没有', '就是', '还是', '可以', '不是', '知道', '现在', '今天', '真的', '一下', '有点', '然后', '因为', '所以', '但是', '的话', '时候', '发的'])
function grams(text) {
  const out = []
  for (const m of String(text ?? '').toLowerCase().matchAll(/[a-z0-9]+|[\u4e00-\u9fff]+/g)) {
    const w = m[0]
    if (w.length === 1) { out.push(w); continue }
    if (/^[a-z0-9]/.test(w)) { out.push(w); continue }
    for (let i = 0; i + 1 < w.length; i++) { const g = w.slice(i, i + 2); if (!STOP.has(g)) out.push(g) }
  }
  return out
}
const docOf = (s) => [s.name, s.name, ...s.aliases, ...s.aliases, s.means, ...s.tags, ...s.tags, s.text].join(' ')

/**
 * 按线索（他说的话 + 她的心情）挑几张。
 * 分数 = BM25 相关度（归一）+ 0.15 × 好用程度 − 0.1 × 刚发过；再从剩下的里随机带 extra 张，免得老是那几张。
 * 表情不多（≤ LIST_ALL_UP_TO）就全给，按分数排。
 */
export function pickStickers(home, cue, { limit = 8, extra = 2, random = Math.random, now = Date.now() } = {}) {
  const all = listStickers(home)
  if (!all.length) return []
  const docs = all.map((s) => { const toks = grams(docOf(s)); const tf = new Map(); for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1); return { s, tf, len: toks.length } })
  const df = new Map()
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  const avg = docs.reduce((n, d) => n + d.len, 0) / docs.length || 1
  const q = [...new Set(grams(cue))]
  const raw = docs.map((d) => {
    let sc = 0
    for (const t of q) {
      const f = d.tf.get(t); if (!f) continue
      const n = df.get(t) ?? 0
      sc += Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)) * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / avg))
    }
    return { s: d.s, rel: sc }
  })
  const top = Math.max(0, ...raw.map((x) => x.rel)) || 1
  const scored = raw.map((x) => {
    const liked = (x.s.good + 1) / (x.s.good + x.s.bad + 2) - 0.5 // 没反馈时是 0
    const recent = now - x.s.lastSent < 10 * 60_000 ? 1 : 0
    return { ...x, score: x.rel / top + 0.15 * liked - 0.1 * recent }
  }).sort((a, b) => b.score - a.score)
  if (all.length <= LIST_ALL_UP_TO) return scored.map((x) => x.s)
  const hit = scored.filter((x) => x.rel > 0).slice(0, limit)
  const rest = scored.filter((x) => !hit.includes(x))
  const lucky = []
  for (let i = 0; i < extra && rest.length; i++) lucky.push(rest.splice(Math.floor(random() * rest.length), 1)[0])
  const fill = hit.length ? [] : scored.slice(0, limit - lucky.length)
  return [...hit, ...fill, ...lucky].map((x) => x.s).filter((s, i, a) => a.indexOf(s) === i)
}

/** 一张写成一行给她看：「哼（也叫嘴硬）：嘴硬、假装生气」。 */
export const stickerLine = (s) => `${s.name}${s.aliases.length ? `（也叫${s.aliases.join('、')}）` : ''}${s.means ? `：${s.means}` : ''}`

// ---------------- 这一句能不能配图：按她的心情和气氛掷骰子

const UP = /开心|甜蜜|黏人|无聊/
const DOWN = /困|难过|委屈|担心/
const PLAYFUL = /哈哈|笑死|嘿嘿|逗|滚|切|哼|略|嘻|hh|233|[?？]{2,}|！{2,}|～|~/i
const SERIOUS = /工作|代码|bug|面试|加班|生病|医院|难受|分手|考试|怎么办/i

/**
 * 这一句配不配表情。基础 15%；她开心、他在逗她 ×2；她困了难过、他在说正事 ×0.3。
 * 按「他这句话」定下来，同一句话里调工具的几步看到的是同一个结果。
 */
export function stickerChance({ feeling = '', hisText = '' } = {}) {
  let p = 0.15
  if (UP.test(feeling)) p *= 2
  if (DOWN.test(feeling)) p *= 0.3
  if (PLAYFUL.test(hisText)) p *= 2
  if (SERIOUS.test(hisText)) p *= 0.3
  return Math.max(0.02, Math.min(0.6, p))
}
export function rollSticker(key, chance) {
  let h = 2166136261
  for (const c of String(key)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) }
  return ((h >>> 0) / 2 ** 32) < chance
}

// ---------------- 发了哪张、他怎么回

/** 她发了一张：记下来，次数 +1。 */
export function noteSent(home, name, { his = '' } = {}) {
  const s = findSticker(home, name)
  if (!s) return
  const at = Date.now()
  mkdirSync(dirname(sentFile(home)), { recursive: true })
  appendFileSync(sentFile(home), JSON.stringify({ at, name: s.name, his: String(his).slice(0, 60) }) + '\n', 'utf8')
  setStickerMeta(home, s.name, { sent: s.sent + 1, lastSent: at })
}

/**
 * 他回了：看上一张没评过的表情（10 分钟以内发的），按他的反应记好坏。
 * 好：他 3 分钟内回、而且接了梗（笑、表情、反问、回了不止一两个字）。不好：隔了很久才回，或者只回「嗯」「。」。
 */
export function judgeSent(home, { mine = '', gapMs = Infinity } = {}) {
  const file = sentFile(home)
  let rows
  try { rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return undefined }
  const last = rows[rows.length - 1]
  if (!last || last.judged || Date.now() - last.at > 10 * 60_000) return undefined
  const t = String(mine).trim()
  const flat = /^[嗯哦噢好行。.…]{1,3}$/.test(t)
  const good = gapMs < 3 * 60_000 && !flat && (PLAYFUL.test(t) || t.length >= 4)
  const bad = flat || gapMs > 15 * 60_000
  last.judged = good ? 'good' : bad ? 'bad' : 'meh'
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  const s = findSticker(home, last.name)
  if (s && last.judged !== 'meh') setStickerMeta(home, s.name, last.judged === 'good' ? { good: s.good + 1 } : { bad: s.bad + 1 })
  return last.judged
}

export { existsSync }
