// 她有多「活」：一个 0–4 的档位，越高她自己做的事越多，花的 token 也越多。
// 和主人聊天本身每档都一样；档位只管她在背后自己跑的那些事，和每次聊天时带多少背景。
// 上不上网不归档位管，她自己判断（主人定的：上网不算干活）。
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const LEVELS = [
  { name: '只聊天', desc: '你找她她才说话。不主动找你、不自己做事、晚上不反思。',
    remind: false, idlePerDay: 0, ownPerDay: 0, reflect: false, exam: false, senses: false, recent: 0 },
  { name: '省着点', desc: '到点问你惦记的事，晚上写日记、反思（不做体检）。一天最多主动找你 4 次。',
    remind: true, idlePerDay: 4, ownPerDay: 0, reflect: true, exam: false, senses: true, recent: 3 },
  { name: '平常', desc: '再加上晚上做体检；你不在时一天有 2 段自己的时间。',
    remind: true, idlePerDay: 8, ownPerDay: 2, reflect: true, exam: true, senses: true, recent: 6 },
  { name: '活泼', desc: '自己的时间一天 4 段。一天最多主动找你 16 次。',
    remind: true, idlePerDay: 16, ownPerDay: 4, reflect: true, exam: true, senses: true, recent: 6 },
  { name: '全开', desc: '自己的时间一天 6 段，聊天时带的背景更多。',
    remind: true, idlePerDay: 16, ownPerDay: 6, reflect: true, exam: true, senses: true, recent: 10 },
]
export const DEFAULT_LEVEL = 2

const fileOf = (home) => join(home, '.data/level.json')

export function readLevel(home) {
  try {
    const n = JSON.parse(readFileSync(fileOf(home), 'utf8')).level
    if (Number.isInteger(n) && n >= 0 && n < LEVELS.length) return n
  } catch {}
  return DEFAULT_LEVEL
}

export function writeLevel(home, level) {
  if (!Number.isInteger(level) || level < 0 || level >= LEVELS.length) throw new Error(`档位要是 0 到 ${LEVELS.length - 1}`)
  mkdirSync(dirname(fileOf(home)), { recursive: true })
  const tmp = `${fileOf(home)}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify({ level, at: Date.now() }) + '\n')
  renameSync(tmp, fileOf(home))
}

/** 当前档位的设置。 */
export const levelOf = (home) => ({ level: readLevel(home), ...LEVELS[readLevel(home)] })
