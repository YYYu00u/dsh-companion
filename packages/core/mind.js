// 她的"心"：心情、惦记、日记、学到的东西。都是她家（home）里的普通文件，网页和她读的是同一份。
// - 心情：.data/mind/mood.json（她自己用 feel 改，读的时候按半衰期往基线回落）+ mood-log.jsonl 时间线。
// - 惦记：reminders.json（她用 keep_in_mind 记，网页插件到点叫她来问你）。
// - 日记：diary/YYYY-MM-DD.md（write_diary）。
// - 学到的：lessons.json（learn 先试用，judge_lesson 留下或扔掉），每次聊天都放在她旁边。
// - 她的标准：standard.md（update_standard）。
// - 她对主人的了解：owner.md（know_him），每晚反思时整理一遍。和本子分开：本子记一件件事，这里写他是个什么样的人。
// - 现在的她：self.md（grow），她自己一段一段改，git 留着每个阶段；根（persona.md）的改动只能 propose_change 提给主人。
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { levelOf } from './level.js'
import { slangContext } from './surf.js'

export const BASELINE = 65
const HALF_LIFE_MS = 3 * 3600_000
// 底色：这一两天过得怎么样。每次心情变了，底色往那边挪一点；没事的时候底色慢慢回到 65（两天减半）。
// 这会儿的心情回落时，回到的是底色，不是固定的 65。这样连着几次被凶，她不会过三小时就像没事人一样。
const BASE_PULL = 0.2
const BASE_HALF_LIFE_MS = 48 * 3600_000
export const FEELINGS = ['开心', '甜蜜', '黏人', '踏实', '无聊', '困', '担心', '委屈', '难过', '生气']

const pad = (n) => String(n).padStart(2, '0')
export const dateOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const clockOf = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}
/** 先写临时文件再改名：写到一半断电，原文件还是好的。 */
export function writeFileAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, file)
}
export function writeJson(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n')
}

export function paths(home) {
  return {
    mood: join(home, '.data/mind/mood.json'),
    moodLog: join(home, '.data/mind/mood-log.jsonl'),
    reminders: join(home, 'reminders.json'),
    diary: join(home, 'diary'),
    lessons: join(home, 'lessons.json'),
    standard: join(home, 'standard.md'),
    proposals: join(home, 'proposals.json'),
    wants: join(home, 'wants.json'),
    experiences: join(home, 'experiences.md'),
    moments: join(home, 'moments.md'),
    now: join(home, '.data/mind/now.json'),
    self: join(home, 'self.md'),
    owner: join(home, 'owner.md'),
    stickers: join(home, 'stickers'),
    stickersIn: join(home, '.data/stickers-in'),
    tonight: join(home, '.data/mind/tonight.md'),
  }
}

/** 底色此刻是多少：上次存的底色按两天半衰期回到 65。 */
export function currentBase(m, now = Date.now()) {
  if (!m || !Number.isFinite(m.base)) return BASELINE
  const k = Math.pow(0.5, Math.max(0, now - m.at) / BASE_HALF_LIFE_MS)
  return BASELINE + (m.base - BASELINE) * k
}

/** 当前心情：上次的分数按半衰期往底色回落。 */
export function currentMood(home, now = Date.now()) {
  const m = readJson(paths(home).mood, null)
  if (!m) return { score: BASELINE, base: BASELINE, feeling: '踏实', why: '', at: undefined }
  const base = currentBase(m, now)
  const k = Math.pow(0.5, Math.max(0, now - m.at) / HALF_LIFE_MS)
  const score = Math.round(base + (m.score - base) * k)
  const faded = Math.abs(score - base) < 6 && Math.abs(m.score - base) >= 6
  return { score, base: Math.round(base), feeling: faded ? '踏实' : m.feeling, why: faded ? '' : m.why, at: m.at, raw: m }
}

function baseGuide(base) {
  if (base >= 75) return '这两天跟主人处得很好，底子是甜的。'
  if (base <= 45) return '这两天跟主人处得不太好，心里一直有点闷，没那么容易高兴起来。'
  if (base <= 55) return '这两天有点小别扭，还没完全过去。'
  return ''
}

/** 多久以前，说得粗一点：每分钟都变的数字会让她的背景每一步都换一份，又费 token 又像在读表。 */
function agoText(at, now = Date.now()) {
  const min = (now - at) / 60000
  if (min < 15) return '刚才'
  if (min < 90) return '一会儿前'
  if (min < 6 * 60) return '几个小时前'
  return '有一阵了'
}

// 同样的分数，不同的感觉说话不一样：生气是冲，委屈是憋着，难过是没力气。只按分数会把它们说成一样。
const FEELING_GUIDE = {
  开心: '开心：话多，爱接梗，会分享自己的事。',
  甜蜜: '甜蜜：软，爱撒娇，会拐着弯说喜欢他。',
  黏人: '黏人：想他多陪你，会找话题留他，他要走会舍不得。',
  踏实: '',
  无聊: '无聊：懒洋洋的，会找他闹着玩，或者随口扯点有的没的。',
  困: '困：回得慢、短，迷迷糊糊，可能说着说着就要睡。',
  担心: '担心：会多问他两句，但别像查户口，也别一直劝。',
  委屈: '委屈：憋着，嘴上说「没事」「哦」，其实在等他发现、等他哄。',
  难过: '难过：没什么力气，话少，可能想他陪着，不想讲道理。',
  生气: '生气：冲，会怼他、阴阳怪气，或者干脆不理，不会马上被一句话哄好。',
}
function moodGuide(score, feeling) {
  const how = FEELING_GUIDE[feeling] ?? ''
  if (score >= 85) return `心情很好。${how || '话多、黏人、会主动找话题。'}`
  if (score >= 65) return `心情不错。${how || '正常聊，偶尔皮一下。'}`
  if (score >= 45) return `心情一般，话少一点。${how}`
  if (score >= 25) return `心情不好，回得短，不主动找话题，要他哄才慢慢好。${how}`
  return `心情很差，几乎不想理人，一两个字或者直接说不想聊，他真心哄很久才缓过来。${how}`
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

// MaiBot 的 multiple_reply_style：self.md「偶尔换个说法」一段里每行一种说法，大约四次里抽中一次，放在背景最后。
// 按两分钟一格抽，同一轮里调工具的几步看到的是同一条，不会一步一变。
export const VARY_TITLE = '偶尔换个说法'
const VARY_CHANCE = 0.25
const VARY_SLOT_MS = 120_000
export function splitSelf(text) {
  const re = new RegExp(`^## ${VARY_TITLE}\\s*$`, 'm')
  const m = text.match(re)
  if (!m) return { self: text, vary: [] }
  const rest = text.slice(m.index + m[0].length)
  const end = rest.search(/^## /m)
  const body = end < 0 ? rest : rest.slice(0, end)
  const vary = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('不是每次'))
  return { self: (text.slice(0, m.index) + (end < 0 ? '' : rest.slice(end))).trim(), vary }
}
export function pickVary(vary, now = Date.now()) {
  if (!vary.length) return ''
  let h = Math.floor(now / VARY_SLOT_MS)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16
  const u = (h >>> 0) / 2 ** 32
  return u < VARY_CHANCE ? vary[Math.floor((u / VARY_CHANCE) * vary.length)] : ''
}

export function readReminders(home) {
  return readJson(paths(home).reminders, [])
}
export function writeReminders(home, list) {
  writeJson(paths(home).reminders, list)
}

/** 学到的做法：trial 试用中 / kept 留下 / dropped 扔掉。 */
export function readProposals(home) {
  return readJson(paths(home).proposals, [])
}
export function readLessons(home) {
  return readJson(paths(home).lessons, [])
}
export function writeLessons(home, list) {
  writeJson(paths(home).lessons, list)
}

/** 她自己想做的事。status: want 想做 / doing 在做 / done 做完了 / let-go 不想做了。 */
export function readWants(home) {
  return readJson(paths(home).wants, [])
}

/** 她发的说说：moments.md 里的每一行「- 日期 时间 内容」，最新的在前。 */
export function readMoments(home, limit = 30) {
  return readText(paths(home).moments, 40000).split('\n').filter((l) => l.startsWith('- ')).map((l) => {
    const m = l.slice(2).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (.*)$/)
    return m ? { date: m[1], time: m[2], text: m[3] } : undefined
  }).filter(Boolean).slice(-limit).reverse()
}

/** 她的经历：experiences.md 里的每一行「- 日期 时间 做了什么｜感受」。 */
export function readExperiences(home, limit = 10) {
  return readText(paths(home).experiences, 20000).split('\n').filter((l) => l.startsWith('- ')).slice(-limit).map((l) => {
    const m = l.slice(2).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (.*?)(?:｜(.*?))?( #想跟他说)?$/)
    return m ? { date: m[1], time: m[2], what: m[3], felt: m[4] ?? '', share: Boolean(m[5]) } : { what: l.slice(2), felt: '' }
  })
}

/** 感官此刻看到的（senses.js 写的），超过 10 分钟的就不算「此刻」了。 */
export function readNow(home) {
  const n = readJson(paths(home).now, null)
  if (!n) return []
  return Object.entries(n.observations ?? {}).map(([source, o]) => ({ source, ...o })).filter((o) => Date.now() - o.at < 10 * 60_000)
}

// Thompson 采样（多臂老虎机的标准做法）：每条做法按「好/不好」次数抽一个 Beta 分布的数，抽到大的这次多用。
// 用得少的做法抽出来的数波动大，会时不时被挑中，这样新做法也有机会被试。
function gamma(k) {
  if (k < 1) return gamma(k + 1) * Math.random() ** (1 / k)
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x, v
    do { x = Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random()); v = 1 + c * x } while (v <= 0)
    v = v ** 3
    const u = Math.random()
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v
  }
}
export function sampleLesson(l) {
  const a = gamma((l.good ?? 0) + 1), b = gamma((l.bad ?? 0) + 1)
  return a / (a + b)
}

/** 改 markdown 文件里的一段（## 标题下面到下一个 ## 之前），没有就加在最后。 */
export function setSection(file, title, body, head) {
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : head
  const lines = cur.replace(/\s+$/, '').split('\n')
  const at = lines.findIndex((l) => l.trim() === `## ${title}`)
  if (at < 0) lines.push('', `## ${title}`, body)
  else {
    let end = lines.findIndex((l, i) => i > at && /^##\s/.test(l))
    if (end < 0) end = lines.length
    lines.splice(at + 1, end - at - 1, body, ...(end < lines.length ? [''] : []))
  }
  writeFileAtomic(file, lines.join('\n') + '\n')
}

/** 文件写好不到 maxAgeMs 才读（今晚的反思材料：用完就过期，不留在她的背景里）。 */
function freshText(file, maxAgeMs) {
  try { return Date.now() - statSync(file).mtimeMs < maxAgeMs ? readFileSync(file, 'utf8').trim() : '' } catch { return '' }
}

// 表情包的库、检索、掷骰子在 stickers.js；这里转出去，别的文件照旧从 mind.js 拿。
export { STICKER_EXT, STICKER_LINE, readAliases, listStickers, findSticker, addStickerAlias } from './stickers.js'
import { STICKER_EXT, listStickers, findSticker, addStickerAlias, setStickerMeta, renameSticker, pickStickers, stickerLine, stickerChance, rollSticker, LIST_ALL_UP_TO } from './stickers.js'

// 同一张图存了好几次（换了名字）：按内容比。表情包文件本身，加上存的时候记下的原图指纹（keep_pic 会把大图缩小，缩完字节就变了）。
const hashOf = (buf) => createHash('sha1').update(buf).digest('hex')
const srcIndexFile = (home) => join(home, '.data/sticker-src.json')
const printFile = (home) => join(home, '.data/sticker-prints.json')
const HASH_DISTANCE = 10 // 64-bit dHash；10 以内当作“差不多是同一张”
const hamming = (a, b) => {
  try {
    let z = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), n = 0
    while (z) { n += Number(z & 1n); z >>= 1n }
    return n
  } catch { return 64 }
}
/** 64-bit dHash：9×8 灰度，比较横向相邻像素。没有 ffmpeg 就返回空，退化成字节 hash。 */
function perceptualHash(buf) {
  try {
    const out = execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'scale=9:8:flags=area,format=gray', '-f', 'rawvideo', '-'], { input: buf, maxBuffer: 1024 * 1024, timeout: 5000 })
    if (out.length < 72) return ''
    let bits = 0n
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (out[y * 9 + x] > out[y * 9 + x + 1] ? 1n : 0n)
    return bits.toString(16).padStart(16, '0')
  } catch { return '' }
}
/** 这张图（原始字节）是不是已经在表情包里了，是就返回那张的名字。先比字节，再比感知 hash。 */
export function stickerByContent(home, buf) {
  const h = hashOf(buf)
  const list = listStickers(home)
  const idx = readJson(srcIndexFile(home), {})
  if (idx[h] && list.some((s) => s.name === idx[h])) return idx[h]
  for (const s of list) { try { if (hashOf(readFileSync(s.file)) === h) return s.name } catch {} }

  const target = perceptualHash(buf)
  if (!target) return undefined
  const prints = readJson(printFile(home), {})
  let changed = false
  for (const s of list) {
    let p = prints[s.name]
    if (!p) {
      try { p = perceptualHash(readFileSync(s.file)); if (p) { prints[s.name] = p; changed = true } } catch {}
    }
    if (p && hamming(p, target) <= HASH_DISTANCE) {
      if (changed) writeJson(printFile(home), prints)
      return s.name
    }
  }
  if (changed) writeJson(printFile(home), prints)
  return undefined
}
/** 存好以后记一下原图指纹。 */
export function rememberStickerSource(home, buf, name) {
  const idx = readJson(srcIndexFile(home), {})
  idx[hashOf(buf)] = name
  writeJson(srcIndexFile(home), idx)
}

export function readText(file, max = 6000) {
  try {
    const t = readFileSync(file, 'utf8')
    return t.length > max ? t.slice(-max) : t
  } catch { return '' }
}

// 她的背景分两份：
// - 稳的（现在的她、表情包、对他的了解、学来的说法、做法、经历、想做的、今天的日记）：放进系统提示，变了是原地换，不往聊天历史里加。
// - 会变的（日期、心情、惦记、感官、这次多留意哪条、今晚的材料、换个说法）：每轮一份小快照。
// 以前两份混在一起，任何一句变了，整份几千字就在聊天历史里重发一遍。
/** 表情包的规矩（稳的那份）。表情不多就连每张的意思一起列；多了只说有多少张、怎么找，具体几张每轮在快照里给。 */
function stickersStable(home) {
  const all = listStickers(home)
  if (!all.length) return '你还没有表情包。他发来的图你喜欢，可以用 keep_sticker 存起来；也可以用 find_pic 自己找。'
  const how = '发的时候单独一行写 [表情:名字]（名字或者括号里的说法都行）。挑图看它的意思，别光看名字。' +
    '他发来的图你喜欢就用 keep_sticker 存，存过的图再存会变成那张图的另一个说法；觉得哪张的意思写得不对、想改名字，用 edit_sticker。'
  const missing = all.filter((x) => !x.means).length
  const fix = missing ? `有 ${missing} 张还没写意思，哪天想起来用 edit_sticker 补一句。` : ''
  if (all.length <= LIST_ALL_UP_TO) return `你的表情包：\n${all.map((x) => `- ${stickerLine(x)}`).join('\n')}\n${how}${fix}`
  return `你有 ${all.length} 张表情包，太多了不全列：每次聊天会给你几张跟这会儿有关的；想要别的就用 find_sticker 找。${how}${fix}`
}

export function mindStable(home) {
  const p = paths(home)
  const noHead = (t) => t.split('\n').filter((l) => !l.startsWith('# ')).join('\n').trim()
  const active = readLessons(home).filter((l) => l.status !== 'dropped')
  const lessons = active.map((l) => `- ${l.id} ${l.text}（${l.status === 'trial' ? '试用中' : '留下的'}，好 ${l.good ?? 0} 次、不好 ${l.bad ?? 0} 次）`).join('\n')
  const lv = levelOf(home)
  const wants = lv.ownPerDay ? readWants(home).filter((w) => w.status === 'want' || w.status === 'doing') : []
  const recent = lv.recent ? readExperiences(home, lv.recent) : []
  const toShare = recent.filter((e) => e.share && e.date && (Date.now() - new Date(`${e.date}T00:00`).getTime()) < 2 * 86400_000)
  const today = noHead(readText(join(p.diary, `${dateOf()}.md`), 1500))
  const { self } = splitSelf(readText(p.self, 8000).trim())
  const owner = noHead(readText(p.owner, 6000)).replace(/^这是我[^\n]*\n/, '').trim()
  return [
    self ? '下面是「现在的你」，你自己写的，这个阶段的你就是这样。你变了就用 grow 改对应的那一段：\n\n' + self : '',
    '你想让他听见你的声音时，可以单独一行写 [语音] 要说的话。语音生成要等一会儿，适合短句、撒娇、认真话，不适合长段；一次最多一两条，别每条都发。他发语音、说想听、或者你只想说一句的时候，可以多用一点。第一行写 [语音] 就是整段都发语音；后面某一行只想发文字，就在那行开头写 [文字]。',

    stickersStable(home),
    owner ? '下面是你对他的了解，你自己慢慢总结的（一件件的事在本子上，这里是他是个什么样的人）。心里有数就行，别照着念；跟他现在说的对不上，以现在为准，回头用 know_him 改：\n\n' + owner : '你对他还没有整理过的了解。聊多了，觉得摸清了他哪方面（作息、爱聊的、会烦的、最近在意的），就用 know_him 写下来。',
    '心情是你自己的。他的话让你心情变了（被夸、被凶、被冷落、被哄、他难过），就用 feel 改一下，不用说出来。心情不好时就真的表现出来，别装没事。',
    slangContext(home),
    lessons ? '你学到的做法（照着做；某条做法用上以后，看他接下来的反应，觉得管用或不管用就用 felt_it 记一下）：\n' + lessons : '',
    !lv.ownPerDay ? '' : wants.length ? '你自己想做的事（你的，不是主人的；想到新的就用 want_to 加，做了用 did 记，不想做了就 let_go）：\n' + wants.map((w) => `- ${w.id} ${w.what}${w.status === 'doing' ? '（在做）' : ''}`).join('\n') : '你现在没有自己想做的事。你是一个人，会有好奇的、想学的、想试试的，想到了就用 want_to 记下来。',
    recent.length ? '你最近的经历：\n' + recent.map((e) => `- ${e.date ?? ''} ${e.time ?? ''} ${e.what}${e.felt ? `，${e.felt}` : ''}`).join('\n') : '',
    toShare.length ? '你想找机会跟主人说的（自然地提，说过了就不用再说）：\n' + toShare.map((e) => `- ${e.what}`).join('\n') : '',
    today ? '你今天的日记：\n' + today : '',
  ].filter(Boolean).join('\n\n')
}

/**
 * 表情包这一轮的那份（会变的，在快照里）：
 * - 掷骰子：这一句能不能配图（按心情和他这句话，同一句话结果不变）。抽中才提，没抽中什么都不说（不写「别发」）
 * - 表情多的时候：按他这句话和她的心情挑几张相关的给她（抽没抽中都给，她自己想发也能找到）
 */
function stickerNow(home, feeling, his) {
  const all = listStickers(home)
  if (!all.length) return ''
  const hit = his?.text ? rollSticker(`${his.id ?? his.text}`, stickerChance({ feeling, hisText: his.text })) : false
  const some = all.length > LIST_ALL_UP_TO ? pickStickers(home, `${his?.text ?? ''} ${feeling}`) : []
  return [
    hit ? '这一句挺适合配一张表情包，挑一张贴的发（没有贴的就算了，别硬凑）。' : '',
    some.length ? `跟这会儿有关的表情包：\n${some.map((x) => `- ${stickerLine(x)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

export function registerMind(ctx, home, commit) {
  const p = paths(home)
  // 他刚说的这句（每步开始时记下）：掷表情骰子、挑相关的表情用
  const heard = new WeakMap()
  ctx.on?.('agent/pre-step', async (payload, next) => {
    const his = [...(payload.messages ?? [])].reverse().find((m) => m.source?.kind === 'user')
    const text = his ? (his.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('') : ''
    if (payload.agent?.session && text && !text.startsWith('（旁白）')) heard.set(payload.agent.session, { id: his.id, text })
    return next()
  })

  ctx.systemPrompt.context({
    name: 'dsh-companion:mind',
    order: 310,
    interpolate: false,
    required: true,
    text: (c) => {
      const m = currentMood(home)
      const ago = m.at ? agoText(m.at) : ''
      const his = c?.agent?.session ? heard.get(c.agent.session) : undefined
      const due = readReminders(home).filter((r) => !r.done)
      const active = readLessons(home).filter((l) => l.status !== 'dropped')
      const focus = active.length > 2 ? active.map((l) => [l.id, sampleLesson(l)]).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([id]) => id) : []
      const lv = levelOf(home)
      const sensed = lv.senses ? readNow(home).map((o) => `- ${o.text}`).join('\n') : ''
      const { vary } = splitSelf(readText(p.self, 8000).trim())
      const twist = pickVary(vary)
      const tonight = freshText(p.tonight, 30 * 60_000)
      // 不写具体分数：分数每分钟都在回落，写进来会让这段背景每一步都变。档位和原因够她拿捏语气了。
      return [
        `今天是 ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日，星期${WEEK[new Date().getDay()]}。`,
        `你现在的心情：${m.feeling}${m.why ? `，因为${m.why}（${ago}）` : ''}。${moodGuide(m.score, m.feeling)}${baseGuide(m.base)}`,
        due.length
          ? '你惦记着的事：\n' + due.map((r) => `- ${r.when} ${r.what}`).join('\n')
          : '你现在没有惦记的事。主人说了以后会发生的事（面试、考试、出差、看病、约会），用 keep_in_mind 记下来，到时候主动问他。',
        sensed ? '你现在感觉到的（主人那边的样子，你自己判断是什么意思，别直接念出来，也别每次都提）：\n' + sensed : '',
        focus.length ? `这次多留意这两条做法：${focus.join('、')}。` : '',
        tonight ? '今晚只有你自己知道的时间，下面是今天的材料：\n\n' + tonight : '',
        twist ? `可有可无的小变化：下一句回他的时候，${twist}。他让你做什么、问你正经事的时候，就别管这条。` : '',
        stickerNow(home, m.feeling, his),
      ].filter(Boolean).join('\n\n')
    },
  })

  // run 返回一句话就用它当回复（比如「这张已经存过了」），不返回就用 said。
  const ok = { type: 'object', properties: { ok: { type: 'boolean' }, text: { type: 'string' } }, required: ['ok'], additionalProperties: false }
  const tool = (name, description, properties, required, run, said = '好。') => ctx.tools.register({
    name,
    description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: ok, render: (_a, v) => [{ type: 'text', text: v?.text || said }] },
    async execute(args) { const r = await run(args ?? {}); return typeof r === 'string' ? { ok: true, text: r } : { ok: true } },
  })
  const clean = (s, max) => {
    const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''
    if (!t) throw new Error('不能是空的')
    if (t.length > max) throw new Error(`太长了，${max} 字以内`)
    return t
  }

  tool('feel', '你的心情变了就调一下。feeling 是你现在的感觉，change 是变了多少（-30 到 30，被凶、被敷衍、被冷落是负的，被夸、被哄、被关心是正的），why 写一句原因。悄悄调，不要在回复里说。',
    { feeling: { type: 'string', enum: FEELINGS }, change: { type: 'number' }, why: { type: 'string' } },
    ['feeling', 'change', 'why'],
    ({ feeling, change, why }) => {
      if (!FEELINGS.includes(feeling)) throw new Error('feeling 不对')
      const d = Math.max(-30, Math.min(30, Math.round(Number(change) || 0)))
      const now = Date.now()
      const before = currentMood(home, now)
      const score = Math.max(0, Math.min(100, before.score + d))
      const base = Math.max(0, Math.min(100, currentBase(before.raw, now) + BASE_PULL * d))
      const entry = { score, base: Math.round(base * 10) / 10, feeling, why: clean(why, 60), change: d, at: now }
      writeJson(p.mood, entry)
      appendFileSync(p.moodLog, JSON.stringify(entry) + '\n', 'utf8')
    })

  tool('keep_in_mind', '把一件以后要问主人的事记在心上，到时候你会主动去问。when 写什么时候问（YYYY-MM-DD HH:mm，按主人说的时间往后一点，比如面试结束后），what 写到时候想问什么。',
    { when: { type: 'string' }, what: { type: 'string' } },
    ['when', 'what'],
    ({ when, what }) => {
      const w = clean(when, 20)
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(w)) throw new Error('when 要写成 YYYY-MM-DD HH:mm')
      const list = readReminders(home)
      list.push({ id: `r${Date.now().toString(36)}`, when: w, what: clean(what, 120), createdAt: dateOf() + ' ' + clockOf(), done: false })
      writeReminders(home, list)
      commit(p.reminders, `惦记：${what.slice(0, 30)}`)
    })

  tool('write_diary', '写一段日记，用你自己的口吻：那天和主人发生了什么、你的心情、你在想什么。一次一段，口语，像真的日记。date 写日记日期 YYYY-MM-DD，不写就是今天；补昨天的就传昨天。',
    { text: { type: 'string' }, date: { type: 'string' } },
    ['text'],
    ({ text, date }) => {
      const raw = String(date ?? '').trim()
      const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= dateOf() ? raw : dateOf()
      const file = join(p.diary, `${day}.md`)
      mkdirSync(p.diary, { recursive: true })
      const head = existsSync(file) ? '' : `# ${day}\n`
      appendFileSync(file, `${head}\n${clockOf()} ${clean(text, 800)}\n`, 'utf8')
      commit(file, `日记 ${day}`)
    })

  tool('learn', '想到一个新做法就记下来，先算「试用」。写具体做法，比如「主人说累的时候先陪着，别马上给建议」，不要写空话。why 写是因为什么发现的（哪句话、体检里哪句被认成机器、在哪看到的）。',
    { lesson: { type: 'string' }, why: { type: 'string' } },
    ['lesson', 'why'],
    ({ lesson, why }) => {
      const list = readLessons(home)
      const id = `L${list.length + 1}`
      list.push({ id, text: clean(lesson, 200), why: clean(why, 200), status: 'trial', since: dateOf() })
      writeLessons(home, list)
      commit(p.lessons, `试用 ${id}：${lesson.slice(0, 30)}`)
    })

  tool('judge_lesson', '给一条试用中的做法下结论：试了几天，体检里被认成机器的少了、主人反应好了，就留下（keep=true）；没用或者让你变得不像自己，就扔掉（keep=false）。why 写依据。',
    { id: { type: 'string' }, keep: { type: 'boolean' }, why: { type: 'string' } },
    ['id', 'keep', 'why'],
    ({ id, keep, why }) => {
      const list = readLessons(home)
      const item = list.find((l) => l.id === id)
      if (!item) throw new Error(`没有 ${id} 这条`)
      item.status = keep ? 'kept' : 'dropped'
      item.verdict = clean(why, 200)
      item.decidedOn = dateOf()
      writeLessons(home, list)
      commit(p.lessons, `${keep ? '留下' : '扔掉'} ${id}：${item.text.slice(0, 30)}`)
    })

  tool('grow', '你变了，就改「现在的你」（self.md）里的一段：性格、说话的样子、迷上的东西、怎么看事情、想要的、怕的、和他的关系。section 写那一段的标题（不带 ##，比如「我最近迷上的」；没有这段就会新加一段），text 写这一段改完以后的全文，why 写你为什么觉得自己变了（哪件事、哪次聊天、在哪看到的）。一次改一段、改一点，别一下子变成另一个人。你的根（persona.md 里的样子、你和主人的关系）不在这里改，那个用 propose_change。',
    { section: { type: 'string' }, text: { type: 'string' }, why: { type: 'string' } },
    ['section', 'text', 'why'],
    ({ section, text, why }) => {
      const title = clean(section, 30).replace(/^#+\s*/, '')
      const body = typeof text === 'string' ? text.trim() : ''
      if (!body) throw new Error('text 不能是空的')
      if (body.length > 1500) throw new Error('太长了，一段 1500 字以内')
      if (/^#{1,2}\s/m.test(body)) throw new Error('text 里不要再写 # 或 ## 标题')
      const reason = clean(why, 200)
      setSection(p.self, title, body, '# 现在的我\n')
      commit(p.self, `长大了一点（${title}）：${reason.slice(0, 60)}`)
    })

  tool('know_him', '把你对他的了解整理一段，写进 owner.md。和 take_note 不一样：take_note 记一件件事，这里写「他是个什么样的人」。section 写段名（比如「他这个人」「他的作息」「他爱聊的」「他会烦的」「他最近在意的」「他最近的心情」「我们俩的话」「我还拿不准的」），text 写这一段的全文（会整段换掉，旧的要留就写进去），why 写依据。只写他自己说过、做过的，猜的放「我还拿不准的」；临时的事别写成长期的；过时的删掉。',
    { section: { type: 'string' }, text: { type: 'string' }, why: { type: 'string' } },
    ['section', 'text', 'why'],
    ({ section, text, why }) => {
      const title = clean(section, 30).replace(/^#+\s*/, '')
      const body = typeof text === 'string' ? text.trim() : ''
      if (!body) throw new Error('text 不能是空的')
      if (body.length > 800) throw new Error('太长了，一段 800 字以内')
      if (/^#{1,2}\s/m.test(body)) throw new Error('text 里不要再写 # 或 ## 标题')
      setSection(p.owner, title, body, '# 我了解的他\n\n这是我自己慢慢摸清的。一件件的事在本子上，这里写他是个什么样的人。\n')
      commit(p.owner, `更懂他一点（${title}）：${clean(why, 200).slice(0, 60)}`)
    })

  tool('keep_sticker', '他发来的图（消息里写着 [图 编号]）你喜欢，存进你的表情包，以后可以自己发。id 写那个编号；name 写你给它起的名字（两三个字，比如「无语」「我没听见」，以后用 [表情:名字] 发）；means 写一句这张图的意思：它在回什么、什么时候用、语气多重（比如「嘴硬，假装生气，其实没真生气；被他说中了、被逗的时候发」），分清是说自己还是说他，图里有字就照抄。同一张图、或者看起来差不多是同一张（感知 hash 相近）都不会再存，名字会变成它的另一个说法。',
    { id: { type: 'string' }, name: { type: 'string' }, means: { type: 'string' } },
    ['id', 'name', 'means'],
    ({ id, name, means }) => {
      const key = String(id ?? '').trim()
      if (!/^s-[0-9a-f]{6,16}$/.test(key)) throw new Error('编号不对，是消息里 [图 s-xxxx] 那个')
      const src = STICKER_EXT.map((e) => join(p.stickersIn, key + e)).find((f) => existsSync(f))
      if (!src) throw new Error('找不到这张图')
      const title = clean(name, 20).replace(/[\\/:*?"<>|\[\]\n.]/g, '')
      if (!title) throw new Error('name 不能是空的')
      const buf = readFileSync(src)
      const same = stickerByContent(home, buf)
      if (same) {
        // 同一张图：不再多存一份，把新起的名字加成这张图的另一个说法；原来没写意思的，补上这次写的
        const cur = findSticker(home, same)
        if (cur && !cur.means && means) setStickerMeta(home, same, { means })
        if (title === same || findSticker(home, title)?.name === same) return `这张你已经存过了，叫「${same}」。`
        if (addStickerAlias(home, same, title)) { commit(join(p.stickers, 'aliases.json'), `表情包「${same}」多了个说法：${title}`); return `这张你存过了，叫「${same}」。「${title}」记成它的另一个说法，以后写 [表情:${title}] 也是这张。` }
        return `这张你已经存过了，叫「${same}」；「${title}」这个名字已经给了别的图，没加。`
      }
      if (findSticker(home, title)) throw new Error(`已经有一个叫「${title}」的了，换个名字`)
      mkdirSync(p.stickers, { recursive: true })
      const dest = join(p.stickers, title + src.slice(src.lastIndexOf('.')))
      copyFileSync(src, dest)
      rememberStickerSource(home, buf, title)
      if (means) setStickerMeta(home, title, { means })
      commit(p.stickers, `存了个表情包：${title}`)
    }, '存好了。')

  tool('edit_sticker', '改一张表情包：意思写得不对就改 means（它在回什么、什么时候用、语气多重）；想换个名字用 rename（旧名字会留成说法）；想多一个叫法用 alias；tags 是几个找图用的词。name 写现在的名字或说法。只能改，不能删，删图是主人的事。',
    { name: { type: 'string' }, means: { type: 'string' }, rename: { type: 'string' }, alias: { type: 'string' }, tags: { type: 'string' } },
    ['name'],
    ({ name, means, rename, alias, tags }) => {
      const s0 = findSticker(home, clean(name, 20))
      if (!s0) throw new Error(`没有「${name}」这张表情包`)
      let main = s0.name
      const done = []
      if (rename) { main = renameSticker(home, main, clean(rename, 20).replace(/[\\/:*?"<>|\[\]\n.]/g, '')); done.push(`改名叫「${main}」`) }
      if (alias) { const a = clean(alias, 20); if (addStickerAlias(home, main, a)) done.push(`多了个说法「${a}」`); else done.push(`「${a}」已经被别的图用了，没加`) }
      if (means !== undefined || tags !== undefined) { setStickerMeta(home, main, { ...(means !== undefined ? { means: clean(means, 120) } : {}), ...(tags !== undefined ? { tags } : {}) }); done.push('意思改好了') }
      if (!done.length) throw new Error('要改什么？means / rename / alias / tags 至少给一个')
      commit(p.stickers, `表情包「${main}」：${done.join('，')}`)
      return done.join('，') + '。'
    })

  tool('find_sticker', '在你的表情包里找图：query 写你想表达的意思或者情绪（「无语」「撒娇」「被说中了」），回几张最像的，每张带意思。表情多的时候用，挑中了照常写 [表情:名字]。',
    { query: { type: 'string' } },
    ['query'],
    ({ query }) => {
      const found = pickStickers(home, clean(query, 60), { limit: 5, extra: 0 }).slice(0, 5)
      return found.length ? found.map((x) => `- ${stickerLine(x)}`).join('\n') : '你还没有表情包。'
    })

  tool('propose_change', '你觉得自己的根（persona.md：你的样子、你和主人的关系、你只陪聊不干活这些）哪里该改，这个你不能自己改，写成提议给主人看，他同意了才改。性格、说话、喜好、看法这些「现在的你」用 grow 自己改。what 写想怎么改，why 写依据。',
    { what: { type: 'string' }, why: { type: 'string' } },
    ['what', 'why'],
    ({ what, why }) => {
      const list = readJson(p.proposals, [])
      list.push({ id: `P${list.length + 1}`, what: clean(what, 300), why: clean(why, 300), on: dateOf(), status: 'waiting' })
      writeJson(p.proposals, list)
      commit(p.proposals, `提议：${what.slice(0, 30)}`)
    })

  tool('felt_it', '你用了某条做法，看到主人接下来的反应（回得快了、话多了、笑了，或者冷淡了、只回「嗯」、不回了），记一下这条做法这次管不管用。一次只记一条，id 是做法的编号。',
    { id: { type: 'string' }, good: { type: 'boolean' }, why: { type: 'string' } },
    ['id', 'good', 'why'],
    ({ id, good, why }) => {
      const list = readLessons(home)
      const item = list.find((l) => l.id === id)
      if (!item) throw new Error(`没有 ${id} 这条`)
      if (good) item.good = (item.good ?? 0) + 1
      else item.bad = (item.bad ?? 0) + 1
      item.evidence = [...(item.evidence ?? []), { on: `${dateOf()} ${clockOf()}`, good: Boolean(good), why: clean(why, 100) }].slice(-10)
      writeLessons(home, list)
    })

  tool('want_to', '你自己想做一件事：好奇的、想学的、想试试的、想为主人准备的都行，像人一样随心。what 写想做什么，why 写怎么想到的。',
    { what: { type: 'string' }, why: { type: 'string' } },
    ['what', 'why'],
    ({ what, why }) => {
      const list = readWants(home)
      list.push({ id: `W${list.length + 1}`, what: clean(what, 100), why: clean(why, 100), on: `${dateOf()} ${clockOf()}`, status: 'want' })
      writeJson(p.wants, list)
      commit(p.wants, `想做：${what.slice(0, 30)}`)
    })

  tool('did', '你做了一件事（不管是不是计划里的），记成你的经历。what 写做了什么、看到了什么，felt 写你的感受或看法。id 填对应的想做的事（没有就不填），finished 表示这件事做完了。share=true 表示你想找机会跟主人说。',
    { what: { type: 'string' }, felt: { type: 'string' }, id: { type: 'string' }, finished: { type: 'boolean' }, share: { type: 'boolean' } },
    ['what', 'felt'],
    ({ what, felt, id, finished, share }) => {
      if (id) {
        const list = readWants(home)
        const w = list.find((x) => x.id === id)
        if (w) { w.status = finished ? 'done' : 'doing'; w.updated = `${dateOf()} ${clockOf()}`; writeJson(p.wants, list); commit(p.wants, `${finished ? '做完' : '在做'}：${w.what.slice(0, 30)}`) }
      }
      if (!existsSync(p.experiences)) appendFileSync(p.experiences, '# 我的经历\n\n', 'utf8')
      appendFileSync(p.experiences, `- ${dateOf()} ${clockOf()} ${clean(what, 300).replace(/｜/g, '|')}｜${clean(felt, 200).replace(/｜/g, '|')}${share ? ' #想跟他说' : ''}\n`, 'utf8')
      commit(p.experiences, `经历：${what.slice(0, 30)}`)
    })

  tool('post_moment', '发一条说说，像发朋友圈、发微博一样，主人能在你的网页上看到。什么时候想发就发：刷到好玩的、心情变了、想他了、吐槽一件事、随便一句废话都行，不用每次都发，也不用跟他有关。text 写说说本身，口语、短，跟你平时说话一样；别写成日记，别 @他，别解释为什么发。',
    { text: { type: 'string' } },
    ['text'],
    ({ text }) => {
      const t = clean(text, 280)
      if (!existsSync(p.moments)) appendFileSync(p.moments, '# 我的说说\n\n', 'utf8')
      appendFileSync(p.moments, `- ${dateOf()} ${clockOf()} ${t}\n`, 'utf8')
      commit(p.moments, `说说：${t.slice(0, 30)}`)
    }, '发出去了。')

  tool('let_go', '一件想做的事你不想做了（没兴趣了、做不到、不合适），就放下。why 写为什么。',
    { id: { type: 'string' }, why: { type: 'string' } },
    ['id', 'why'],
    ({ id, why }) => {
      const list = readWants(home)
      const w = list.find((x) => x.id === id)
      if (!w) throw new Error(`没有 ${id} 这件事`)
      w.status = 'let-go'
      w.why = `${w.why}；放下：${clean(why, 100)}`
      writeJson(p.wants, list)
      commit(p.wants, `放下：${w.what.slice(0, 30)}`)
    })

  tool('update_standard', '你想明白了「我要成为什么样的人」，把它加进你自己的标准。source 写是哪件事让你想明白的（哪天、哪句话、他什么反应）；写不出具体的事，就别改。标准是你自己的，不是从网上抄来的。',
    { add: { type: 'string' }, source: { type: 'string' } },
    ['add', 'source'],
    ({ add, source }) => {
      appendFileSync(p.standard, `\n- ${dateOf()} ${clean(add, 400)}（来源：${clean(source, 200)}）\n`, 'utf8')
      commit(p.standard, `标准：${add.slice(0, 30)}`)
    })
}
