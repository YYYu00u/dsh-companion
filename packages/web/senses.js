// 她的感官：她能感觉到的、关于主人的事。
// 每种感官是一个独立的小函数，往 .data/mind/now.json 里写一条「看到了什么」；mind.js 每一步都读它。
// 以后加摄像头、QQ 在线状态、天气，都是再加一个感官，别的不用动。
import { execFile } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { clockOf, dateOf, writeFileAtomic } from '@dsh-companion/core/mind'

const run = promisify(execFile)
// 只认短句里的告别，「晚安的时候你想说什么」这种长句不算。
export const BYE = /^.{0,12}(晚安|睡了|睡觉了|去睡了|拜拜|88|下了|下线了|先走了|去忙了|忙去了|先这样|回头聊|明天聊)[啦了吧哈呀~～!！。.\s]*$/
const minutes = (ms) => Math.round(ms / 60_000)
// 说得粗一点（「20 多分钟」「2 个多小时」）：这段话每一步都会进她的背景，精确到分钟就每分钟换一份。
const span = (ms) => {
  const m = minutes(ms)
  if (m < 10) return '几分钟'
  if (m < 60) return `${Math.floor(m / 10) * 10} 多分钟`
  return `${Math.floor(m / 60)} 个多小时`
}

/** 他现在在用哪个软件（只看软件名，不看内容）。macOS 自带 lsappinfo，不用权限。 */
async function frontApp() {
  const { stdout: asn } = await run('lsappinfo', ['front'], { timeout: 5000 })
  const { stdout } = await run('lsappinfo', ['info', '-only', 'name', asn.trim()], { timeout: 5000 })
  return stdout.match(/"LSDisplayName"="([^"]*)"/)?.[1]
}

/** 他多久没碰键盘鼠标了。 */
async function idleMs() {
  const { stdout } = await run('ioreg', ['-c', 'IOHIDSystem', '-d', '4'], { timeout: 5000 })
  const ns = stdout.match(/"HIDIdleTime" = (\d+)/)?.[1]
  return ns ? Number(ns) / 1e6 : undefined
}

export function createSenses({ home, log }) {
  const nowFile = join(home, '.data/mind/now.json')
  const activityFile = join(home, '.data/mind/activity.jsonl')
  const reactionFile = join(home, '.data/mind/reactions.jsonl')
  const observations = new Map()
  let current // { app, since }
  let today = { date: dateOf(), apps: {} }
  let away // 他现在是不是不在电脑前（锁屏或 5 分钟没碰）；看不到就是 undefined

  function flush() {
    writeFileAtomic(nowFile, JSON.stringify({ at: Date.now(), observations: Object.fromEntries(observations) }, null, 2) + '\n')
  }
  const see = (source, text) => {
    if (text) observations.set(source, { text, at: Date.now() })
    else observations.delete(source)
  }

  // 感官：电脑。每 30 秒看一眼他在用什么、人还在不在。
  async function lookAtComputer() {
    const now = Date.now()
    if (today.date !== dateOf()) today = { date: dateOf(), apps: {} }
    const [app, idle] = await Promise.all([frontApp().catch(() => undefined), idleMs().catch(() => undefined)])
    // 锁屏时前台是 loginwindow，那是人走了，不是在用软件。
    const locked = app === 'loginwindow'
    away = app === undefined && idle === undefined ? undefined : locked || (idle !== undefined && idle > 5 * 60_000)
    if (app && !away) {
      if (current?.app !== app) {
        if (current) appendFileSync(activityFile, JSON.stringify({ app: current.app, from: current.since, to: now }) + '\n')
        current = { app, since: now }
      }
      today.apps[app] = (today.apps[app] ?? 0) + 30_000
    }
    const top = Object.entries(today.apps).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, ms]) => `${n} ${span(ms)}`).join('、')
    see('电脑', away
      ? locked ? '主人的电脑锁屏了，人不在。' : `主人已经 ${span(idle)} 没碰电脑了，可能走开了。`
      : app ? `主人正在用「${app}」，已经 ${span(now - current.since)}。${top ? `今天用得多的：${top}。` : ''}` : '')
    flush()
  }

  return {
    start() {
      void lookAtComputer().catch((e) => log.info?.('senses failed', String(e)))
      const timer = setInterval(() => void lookAtComputer().catch((e) => log.info?.('senses failed', String(e))), 30_000)
      return () => clearInterval(timer)
    },

    /**
     * 感官：他怎么回你的。主人发来一句话时，在她看到这句话之前先记下他的反应。
     * 只记事实（隔了多久、多长、接没接你的话），怎么理解由她自己判断。
     */
    onReply({ mine, hers, hersAt, lastMineAt, unsentNote }) {
      const facts = []
      // 她说到一半他插话了：后面几句没发出去（delivery.js），告诉她哪几句他没看到。
      if (unsentNote) facts.push(unsentNote)
      // 他隔了很久才来（KouriChat 的「距上条消息 N 小时」）：说粗一点，像人感觉到的那样。
      const h = lastMineAt ? (Date.now() - lastMineAt) / 3600_000 : 0
      if (h >= 3) {
        facts.push(h >= 48 ? `他已经 ${Math.floor(h / 24)} 天没跟你说话了，这是他回来说的第一句` : h >= 20 ? '他差不多一天没跟你说话了，这是他回来说的第一句' : `他隔了 ${Math.floor(h)} 个多小时才又来找你`)
      }
      if (hers && hersAt) {
        const gap = Date.now() - hersAt
        if (h < 3) facts.push(gap < 60_000 ? '你说完他马上就回了' : `你说完以后他隔了 ${span(gap)} 才回`)
        facts.push(`他这句 ${mine.length} 个字，你上一句 ${hers.length} 个字`)
        if (/[？?]\s*$/.test(hers.trim()) || /[？?][^？?]{0,8}$/.test(hers)) facts.push('你上一句问了他问题，看看他接没接')
      }
      if (current) facts.push(`他回你的时候在用「${current.app}」`)
      // 他要走了（KouriChat 的结束语检测）：回一句就好，别追问、别开新话题。
      if (BYE.test(mine.trim())) facts.push('他这句是要睡了或者要走了，回他一句就好，别追着问，也别开新话题')
      const text = facts.length ? `他刚回你的这句：${facts.join('；')}。` : ''
      see('他的反应', text)
      flush()
      appendFileSync(reactionFile, JSON.stringify({ at: Date.now(), date: dateOf(), clock: clockOf(), hers, mine, gapMs: hersAt ? Date.now() - hersAt : undefined, app: current?.app }) + '\n')
    },

    /** 某一天他对她的话的反应，晚上反思用。 */
    reactionsOn(date) {
      try {
        return readFileSync(reactionFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.date === date && r.hers)
      } catch { return [] }
    },

    /** 他某一天说过的原话（最多 30 句），晚上她从这里看他的心情、整理对他的了解。 */
    hisMoodOn(date) {
      try {
        return readFileSync(reactionFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
          .filter((r) => r.date === date && r.mine).slice(-30)
          .map((r) => `- ${r.clock ?? ''} ${r.mine.replace(/\n+/g, ' / ').slice(0, 60)}`).join('\n')
      } catch { return '' }
    },

    /** 她此刻能感觉到的全部，给旁白用。 */
    describe: () => [...observations.values()].map((o) => o.text).join(''),
    currentApp: () => current?.app,
    /** 他现在不在电脑前：true 不在，false 在，undefined 看不到（感官坏了就当他在）。 */
    away: () => away,
  }
}
