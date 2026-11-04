// 发送层：他说的话怎么进来、她说的话怎么出去。网页、桌宠（以后 QQ）都走这里。
// 进：他连着发几条，等他停下来（静 3 秒，最多等 8 秒）再合成一条交给她。MaiBot 的防抖。
// 出：她一次回的几行拆成几条，第一条马上发，后面按字数隔一会儿再发。KouriChat elixir 的节奏。
//     他在她还没发完时插话：剩下的就不发了，并在他这条前面告诉她「哪几句他没看到」。
//     偶尔打错一个字，下一条补一句「*对的」。
//     [表情:名字] 单独成一条，带上 sticker 字段，网页和桌宠显示成图；没有这个表情就不发。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STICKER_LINE, writeFileAtomic } from '@dsh-companion/core/mind'

export const QUIET_MS = 3000
export const MAX_WAIT_MS = 8000
const TYPO_CHANCE = 0.04
// 拼音输入法常见的错字：打错的那个字 ← 想打的字。
const TYPOS = { 的: '得', 在: '再', 再: '在', 做: '作', 那: '哪', 哪: '那', 吗: '嘛', 已: '以', 象: '像', 到: '道', 得: '的', 吧: '把', 呢: '哪', 么: '没', 想: '像', 是: '事', 就: '旧' }

/** 她的一条回复拆成几条：按换行分；括号里的小动作单独一条；最多 6 条。和网页 app.js 的 split 一样。 */
export function splitReply(text) {
  // self.md 的语气例子用「\」表示分条，她偶尔照抄进回复，这里也当换行。
  const parts = text.split(/\n+|\|\|\||\s*\\\s*/)
    .flatMap((s) => s.split(/(（[^）]{1,40}）|\([^)]{1,40}\)|\[表情[:：][^\]\n]{1,20}\])/))
    .map((s) => s.trim()).filter(Boolean)
  return parts.length > 6 ? [...parts.slice(0, 5), parts.slice(5).join('\n')] : parts
}

/** 两条之间等多久：随机 0.6–1.5 秒，加上下一条每个字 0.15 秒，最多 4 秒。 */
export const gapBefore = (text, random = Math.random) => Math.min(4000, 600 + 900 * random() + [...text].length * 150)

/** 偶尔打错一个字：返回 [错的那条, 更正]，没打错就是 undefined。 */
export function typoOf(text, random = Math.random) {
  if (random() >= TYPO_CHANCE || [...text].length < 4 || /^[（(\[]/.test(text)) return undefined
  const chars = [...text]
  const at = chars.findIndex((c, i) => i > 0 && TYPOS[c])
  if (at < 0) return undefined
  const fixed = chars.slice(at, at + 2).join('')
  return [chars.with(at, TYPOS[chars[at]]).join(''), `*${fixed}`]
}

/** 拆出来的一条：是表情就带上 sticker（名字），没有这个表情返回 undefined（不发）。 */
export function partOf(text, hasSticker) {
  const m = text.match(STICKER_LINE)
  if (!m) return { text }
  const name = m[1].trim()
  return hasSticker(name) ? { text: `[${name}]`, sticker: name } : undefined
}

export function createDelivery({ home, deliver, toHer, hasSticker = () => false, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random, now = Date.now }) {
  const unsentFile = join(home, '.data/unsent.json')
  const readUnsent = () => { try { return JSON.parse(readFileSync(unsentFile, 'utf8')) } catch { return {} } }

  // ---- 出
  const outbox = [] // { row, text, i, n }
  let sending = false
  const afterDrain = []
  let cut // 被他打断时没发出去的：{ seq, from, texts }

  async function drain() {
    if (sending) return
    sending = true
    while (outbox.length) {
      const item = outbox[0]
      if (item.i > 0) await sleep(gapBefore(item.text, random))
      if (outbox[0] !== item) continue // 等的时候被他打断了
      outbox.shift()
      const part = partOf(item.text, hasSticker)
      if (!part) continue
      const typo = !part.sticker && typoOf(item.text, random)
      deliver({ ...item.row, ...part, text: typo ? typo[0] : part.text, seq: `${item.row.seq}.${item.i}`, part: item.i, last: !outbox.some((o) => o.row.seq === item.row.seq) && !typo })
      if (typo) { await sleep(800 + 700 * random()); deliver({ ...item.row, text: typo[1], seq: `${item.row.seq}.${item.i}t`, part: item.i, last: !outbox.some((o) => o.row.seq === item.row.seq) }) }
    }
    sending = false
    for (const fn of afterDrain.splice(0)) fn()
  }

  function interrupt() {
    if (!outbox.length) return
    const first = outbox[0]
    const left = outbox.filter((o) => o.row.seq === first.row.seq)
    outbox.length = 0
    cut = { seq: first.row.seq, from: first.i, texts: left.map((o) => o.text) }
    const all = readUnsent()
    all[first.row.seq] = first.i
    writeFileAtomic(unsentFile, JSON.stringify(all) + '\n')
  }

  // ---- 进
  let held = [] // 他还没交给她的话
  let heldImages = [] // 他连着发的图
  let firstAt = 0
  let timer

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (!held.length) return
    const text = held.join('\n')
    const images = heldImages
    held = []
    heldImages = []
    let note = ''
    if (cut) {
      note = `你上一条后面这几句还没发出去他就说话了，他没看到：「${cut.texts.join(' / ')}」，还想说就再说，不想说就算了`
      cut = undefined
    }
    toHer(text, note, images)
  }

  return {
    /** 她说了一条（会话事件里的一行）。 */
    out(row) {
      const parts = splitReply(row.text)
      parts.forEach((text, i) => outbox.push({ row, text, i }))
      void drain()
    },
    /** 他发来一句（发图时 text 是「[图 编号]」，image 是图本身）。 */
    in(text, image) {
      interrupt()
      if (!held.length) firstAt = now()
      held.push(text)
      if (image) heldImages.push(image)
      clearTimeout(timer)
      const wait = Math.min(QUIET_MS, Math.max(0, firstAt + MAX_WAIT_MS - now()))
      timer = setTimeout(flush, wait)
    },
    /** 他还有话没交给她（life 不要这时候去打扰）。 */
    holding: () => held.length > 0,
    sending: () => sending,
    /** 她这一轮的话都发完以后再做（比如告诉网页「她说完了」）。 */
    whenDrained(fn) { if (!sending && !outbox.length) fn(); else afterDrain.push(fn) },
    /** 历史记录里，被打断没发出去的那几句要藏起来：seq → 从第几条开始没发。 */
    unsent: readUnsent,
    dispose() { clearTimeout(timer) },
  }
}
