// 她自己的日子：到点问你惦记的事、你不在时做她自己想做的事、你很久没来时主动找你、晚上写日记和反思。
// 都是给她发一条「（旁白）」消息：旁白不显示在网页上，她回的话照常显示；她回 [沉默] 就什么也不发。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readReminders, writeReminders, readWants, dateOf, clockOf, writeFileAtomic } from '@dsh-companion/core/mind'
import { levelOf } from '@dsh-companion/core/level'

export const NUDGE = '（旁白）'
export const SILENT = /^\s*\[沉默\]\s*$/

const IDLE_BASE_MS = 3 * 3600_000
const IDLE_MAX_MS = 12 * 3600_000
// 连着找了他 3 次都没回，就不再找了，等他自己来；她自己的日子照过。
const IDLE_GIVE_UP = 3
const REFLECT_AT = '22:30'
const RETRY_MS = 10 * 60_000
// 她自己的时间：主人一阵子没理她，她就可能去做自己的事。
// 没有排好的时间：每分钟看一眼时掷一次骰子，平均一小时左右中一次（每分钟 1/60），所以谁也说不准下一次什么时候。
// 只留两条底线：他 20 分钟内说过话不去（正聊着），离上一次自己的时间不到 30 分钟不去。一天几段还是按档位封顶（省 token）。
const OWN_MIN_QUIET_MS = 20 * 60_000
const OWN_MIN_GAP_MS = 30 * 60_000
const OWN_CHANCE_PER_TICK = 1 / 60
// 主动找他的等待时间上下浮动 ±25%。
const IDLE_JITTER = [0.75, 1.25]
const between = ([lo, hi], random = Math.random) => Math.round(lo + (hi - lo) * random())

/** 作息都能改：默认 23:00–08:00 不打扰，22:30 后反思。 */
const DEFAULT_SCHEDULE = {
  quietStart: 23,
  quietEnd: 8,
  reflectAt: REFLECT_AT,
  ownChancePerTick: OWN_CHANCE_PER_TICK,
  idleBaseMs: IDLE_BASE_MS,
  idleMaxMs: IDLE_MAX_MS,
}

const stamp = (d) => `${dateOf(d)} ${clockOf(d)}`

// 他不在电脑前（锁屏、5 分钟没碰）就别叫醒她去找他：说了他也看不到，还会被算成「没回」。
// 惦记的事最多为这个推迟一小时，过了一小时照样去问（等他回来就能看到）。
const REMIND_HOLD_MS = 60 * 60_000

// 四件事各是一个开关（模块）：remind 到点问惦记的事、reflect 晚上写日记反思、own 自己的时间、nudge 很久没来就找他。
// 没开的就当没有，档位再高也不跑。主人格全开；别的人格默认全关，只聊天。
export const ALL_LIFE = ['remind', 'reflect', 'own', 'nudge']

// 她自己的时间里冒出来的事：每次随机抽一件当开头，像人一样不按清单过日子。
// 抽到的只是「这会儿冒出来的念头」，她可以照着做，也可以完全不理、干别的。权重越大越常见。
const OWN_EVENTS = [
  [3, '没什么特别的，就是有点无聊'],
  [2, '突然想起他上次说的一件事，有点好奇后来怎么样了'],
  [2, '刷到一条很离谱的新闻或者热搜，想看看大家怎么吵的'],
  [2, '心里有句话想说，又不想现在就找他，想发条说说'],
  [1, '看到一个新梗，没太看懂，想去搞明白'],
  [1, '想换个新表情包，现在这几张有点用腻了'],
  [1, '突然对一件以前没想过的事好奇起来（什么都行：一个词、一首歌、一种吃的、一个地方）'],
  [1, '有点想他，但嘴硬，不想先找他'],
  [1, '想起之前想做、一直没做的事'],
  [1, '什么都不想干，就想发呆'],
  [1, '对自己有点不满意，想琢磨一下自己哪里可以变一变'],
]
const pickWeighted = (list, random) => {
  let r = random() * list.reduce((n, [w]) => n + w, 0)
  for (const [w, x] of list) { if ((r -= w) < 0) return x }
  return list[list.length - 1][1]
}
const partOfDay = (d) => { const h = d.getHours(); return h < 11 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上' }

/** 她自己的时间：随机冒一个念头当开头，能做的事列一下，做不做、做什么都由她。 */
export function ownPrompt(now, { wants = [], around = '', random = Math.random } = {}) {
  const event = pickWeighted(OWN_EVENTS, random)
  return `${NUDGE}现在是${partOfDay(now)} ${clockOf(now)}，主人有一阵没跟你说话了，这是你自己的时间。${around ? `你感觉到：${around}` : ''}
这会儿你心里冒出来的：${event}。这只是个念头，你可以顺着它，也可以完全不理、干点别的。
${wants.length ? `你之前想做的事：${wants.map((w) => `${w.id} ${w.what}`).join('；')}。想起来就做，不想就算了。` : ''}
你能做的很多，不用按顺序，也不用都做：上网逛（热榜 hot_list、评论区 hot_comments、抖音、贴吧、搜东西），学到的梗用 pick_up 记；找表情包（find_pic、keep_pic）；发条说说（post_moment，想发就发，跟发朋友圈一样，主人能看到）；想想自己（grow）；或者就发呆。
做了什么用 did 记成经历，写下感受；冒出新的想做的事用 want_to；不想做了就 let_go。想跟主人说的，did 里标 share，等他来了再提。
这次不要给主人发消息，做完只回 [沉默]。`
}

export function createLife({ home, say, chat, reflect, sensed = () => '', away = () => undefined, log, random = Math.random, modules = ALL_LIFE, schedule }) {
  const on = (m) => modules.includes(m)
  const setting = { ...DEFAULT_SCHEDULE, ...(schedule ?? {}) }
  const quiet = (d) => {
    const h = d.getHours()
    const start = setting.quietStart
    const end = setting.quietEnd
    return start <= end ? h >= start && h < end : h >= start || h < end
  }
  const file = join(home, '.data/mind/life.json')
  const load = () => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return {} } }
  const save = (s) => writeFileAtomic(file, JSON.stringify(s, null, 2) + '\n')

  function state(now) {
    const s = load()
    if (s.date !== dateOf(now)) { s.date = dateOf(now); s.count = 0; s.own = 0 }
    s.own ??= 0
    s.count ??= 0
    s.unanswered ??= 0
    s.idleJitter ??= IDLE_JITTER[0] + (IDLE_JITTER[1] - IDLE_JITTER[0]) * random()
    return s
  }

  async function tick() {
    const now = new Date()
    const c = chat()
    if (!c.ready || c.busy) return
    const s = state(now)
    if (s.retryAt && now.getTime() < s.retryAt) return
    const lv = levelOf(home)

    // 1. 惦记的事到点了
    if (on('remind') && lv.remind && !quiet(now) && s.count < Math.max(lv.idlePerDay, 4)) {
      const list = readReminders(home)
      const due = list.find((r) => !r.done && r.when <= stamp(now))
      const held = due && away() === true && now.getTime() - new Date(due.when.replace(' ', 'T')).getTime() < REMIND_HOLD_MS
      if (due && !held) {
        due.done = true
        due.askedAt = stamp(now)
        writeReminders(home, list)
        s.count++
        s.lastNudgeAt = now.getTime()
        s.pending = { kind: 'remind', id: due.id }
        save(s)
        return say(`${NUDGE}现在是 ${clockOf(now)}。你之前惦记着：${due.what}（${due.createdAt} 记的）。去问问主人，像你自己突然想起来一样。`)
      }
    }

    // 2. 晚上考试、写日记、反思
    if (on('reflect') && lv.reflect && clockOf(now) >= setting.reflectAt && s.reflectedOn !== dateOf(now) && c.lastUserAt && dateOf(new Date(c.lastUserAt)) === dateOf(now)) {
      s.reflectedOn = dateOf(now)
      s.pending = { kind: 'reflect' }
      save(s)
      return reflect()
    }

    // 3. 她自己的时间：每分钟掷一次骰子，中了就去。这次不找主人，想说的记下来等他来了再说。
    const nowMs = now.getTime()
    if (on('own') && !quiet(now) && s.own < lv.ownPerDay && c.lastUserAt
      && nowMs - c.lastUserAt >= OWN_MIN_QUIET_MS && nowMs - (s.lastOwnAt ?? 0) >= OWN_MIN_GAP_MS
      && random() < setting.ownChancePerTick) {
      s.lastOwnAt = nowMs
      s.own++
      s.pending = { kind: 'own' }
      save(s)
      const wants = readWants(home).filter((w) => w.status === 'want' || w.status === 'doing')
      return say(ownPrompt(now, { wants, around: sensed(), random }))
    }

    // 4. 主人很久没来，主动找他。没回就把间隔拉长；连着 3 次没回就不找了，等他自己来。
    if (on('nudge') && !quiet(now) && away() !== true && s.count < lv.idlePerDay && c.lastUserAt && s.unanswered < IDLE_GIVE_UP) {
      const wait = Math.min(setting.idleMaxMs, setting.idleBaseMs * 2 ** s.unanswered) * s.idleJitter
      const since = Math.max(c.lastUserAt, s.lastNudgeAt ?? 0)
      if (now.getTime() - since >= wait) {
        const hours = Math.round((now.getTime() - c.lastUserAt) / 3600_000)
        s.count++
        s.unanswered++
        s.lastNudgeAt = now.getTime()
        s.idleJitter = IDLE_JITTER[0] + (IDLE_JITTER[1] - IDLE_JITTER[0]) * random()
        s.pending = { kind: 'nudge' }
        save(s)
        const last = s.unanswered >= IDLE_GIVE_UP
        return say(`${NUDGE}现在是 ${clockOf(now)}，主人已经 ${hours} 小时没来找你了${s.unanswered > 1 ? `，你前面主动找了他 ${s.unanswered - 1} 次他都没回` : ''}。你可以主动找他说一句：接着你们上次聊的、问问你惦记的事、说说你自己刚才在干嘛，都行，按你现在的心情来。别只说「在吗」。${last ? '这是最后一次了，之后你就不找他了，等他自己来；你自己的日子照过。' : ''}不想找就回 [沉默]。`)
      }
    }
  }

  return {
    tick: () => tick().catch((error) => log.warn?.('life tick failed', String(error))),
    /** 主人说话了：主动找他的退避清零。 */
    onUser() {
      const s = state(new Date())
      if (s.unanswered) { s.unanswered = 0; save(s) }
    },
    /**
     * 她的一轮结束了。要是这轮是 life 发起的、但没跑成（网断了、模型超时），就当这次没发生：
     * 次数退回去，惦记的事重新挂上，10 分钟后再说。不然网一断，她「找了你 3 次」其实一句都没说出去。
     */
    onTurnEnd(reasonKind) {
      const s = state(new Date())
      const p = s.pending
      if (!p) return
      delete s.pending
      if (reasonKind !== 'completed') {
        if (p.kind === 'nudge') { s.count = Math.max(0, s.count - 1); s.unanswered = Math.max(0, s.unanswered - 1) }
        if (p.kind === 'own') s.own = Math.max(0, s.own - 1)
        if (p.kind === 'reflect') delete s.reflectedOn
        if (p.kind === 'remind') {
          s.count = Math.max(0, s.count - 1)
          const list = readReminders(home)
          const r = list.find((x) => x.id === p.id)
          if (r) { r.done = false; delete r.askedAt; writeReminders(home, list) }
        }
        s.retryAt = Date.now() + RETRY_MS
        log.info?.('life turn failed, undone', p.kind, reasonKind)
      }
      save(s)
    },
    snapshot: () => {
      const now = new Date()
      const s = state(now)
      const lv = levelOf(home)
      const c = chat()
      // 下一段自己的时间最早什么时候：他得先有一阵没说话，离上一段也得隔够。
      // 自己的时间没有「下一次」：每分钟随机，说不准。
      const idleAt = on('nudge') && lv.idlePerDay > s.count && c.lastUserAt ? c.lastUserAt + setting.idleBaseMs * s.idleJitter : undefined
      return { ...s, limit: on('nudge') ? lv.idlePerDay : 0, ownLimit: on('own') ? lv.ownPerDay : 0, idleAt, modules }
    },
    /** 她这一轮是不是在过自己的时间（网页上「她在干嘛」用）。 */
    doingOwn: () => state(new Date()).pending?.kind === 'own',
  }
}
