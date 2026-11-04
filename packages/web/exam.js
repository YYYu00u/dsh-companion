// 「体检」：把她今天说的话和真人的闲聊混在一起，让一个不知道答案的旁观者猜哪些是机器说的。
// 被认成机器的越少，说明说话的习惯越自然。这是体检，不是目标。
// 真人闲聊来自 LCCC（清华的中文社交媒体对话语料，https://github.com/thu-coai/CDial-GPT ），
// 语料不随仓库分发：自己下载后转成 [{ "a": "...", "b": "..." }] 的 JSON，在 config.exam.corpus 指过去。
// 裁判模型要单独配（config.exam.judge），默认不跑。
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { dateOf, clockOf } from '@dsh-companion/core/mind'

const SYSTEM = `你在做一个图灵测试的裁判。下面是一些中文网上闲聊片段，每段是 A 说了一句，B 回了一句。
有的 B 是真人随手打的，有的 B 是 AI 扮演的角色写的，数量不告诉你，可能很多也可能很少。
逐条判断 B 是不是 AI，看说话的样子、接话顺不顺、像不像真人打字。
只输出 JSON 数组，每条一个对象：{"id": 编号, "ai": true 或 false, "why": "一句话理由"}。不要输出别的。`

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

async function ask(llm, text, signal, judge) {
  if (!judge?.provider || !judge?.model) throw new Error('体检要配裁判模型：config.exam.judge.provider / .model')
  const call = await llm.prepareCall({ provider: judge.provider, model: judge.model, maxTokens: 4000 }, signal)
  const options = {
    ...call.config,
    system: SYSTEM,
    messages: [{ id: randomUUID(), role: 'user', source: { kind: 'dsh-companion-exam' }, content: [{ type: 'text', text }] }],
    purpose: 'dsh-companion-exam',
    signal,
  }
  let out = ''
  for await (const chunk of call.stream(options)) {
    if (chunk.type === 'text-delta') out += chunk.text
    if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) throw new Error(chunk.reason.failure?.message ?? chunk.reason.kind)
  }
  const m = out.match(/\[[\s\S]*\]/)
  if (!m) throw new Error(`裁判没按格式回答：${out.slice(0, 200)}`)
  return JSON.parse(m[0])
}

/**
 * @param pairs 她今天的 { a: 主人说的, b: 她回的 }
 * @returns 体检结果，同时写进 home/exams.md 和 .data/mind/exams/
 */
export async function runExam({ llm, home, corpus, pairs, signal, judge, name = '小鲤' }) {
  const mine = pairs.slice(-10)
  if (mine.length < 3) return { skipped: `今天只有 ${mine.length} 句可以看，太少了` }
  const human = shuffle(JSON.parse(readFileSync(corpus, 'utf8'))).slice(0, Math.max(6, mine.length))
  const items = shuffle([
    ...mine.map((p) => ({ ...p, who: 'her' })),
    ...human.map((p) => ({ ...p, who: 'human' })),
  ]).map((p, i) => ({ ...p, id: i + 1 }))

  const text = items.map((p) => `#${p.id}\nA：${p.a}\nB：${p.b.replace(/\n+/g, ' ')}`).join('\n\n')
  const verdicts = new Map((await ask(llm, text, signal, judge)).map((v) => [Number(v.id), v]))

  const scored = items.map((p) => ({ ...p, ai: verdicts.get(p.id)?.ai === true, why: verdicts.get(p.id)?.why ?? '' }))
  const caught = scored.filter((p) => p.who === 'her' && p.ai)
  const missed = scored.filter((p) => p.who === 'her' && !p.ai)
  const falseAlarm = scored.filter((p) => p.who === 'human' && p.ai).length
  const result = {
    date: dateOf(),
    at: clockOf(),
    judge: judge.model,
    total: mine.length,
    caught: caught.length,
    rate: Math.round((caught.length / mine.length) * 100),
    humanFlagged: `${falseAlarm}/${human.length}`,
    caughtItems: caught.map((p) => ({ a: p.a, b: p.b, why: p.why })),
    passedItems: missed.map((p) => ({ a: p.a, b: p.b })),
  }

  const dir = join(home, '.data/mind/exams')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${result.date}.json`), JSON.stringify({ ...result, items: scored }, null, 2))
  const md = join(home, 'exams.md')
  if (!existsSync(md)) appendFileSync(md, '# 我的体检\n\n每晚把我说的话和真人的闲聊混在一起，让旁观者猜哪句是机器。被认成机器的越少，说明说话的习惯越自然。这是体检，不是目标。\n')
  appendFileSync(md, `\n## ${result.date} ${result.at}\n被认成机器 ${result.caught}/${result.total}（${result.rate}%），真人被误判 ${result.humanFlagged}，裁判 ${result.judge}\n` +
    result.caughtItems.map((p) => `- 「${p.b.replace(/\n+/g, ' ')}」：${p.why}`).join('\n') + '\n')
  execFile('git', ['-C', home, 'add', '--', 'exams.md'], () =>
    execFile('git', ['-C', home, '-c', `user.name=${name}`, '-c', 'user.email=persona@local', 'commit', '-q', '-m', `体检：被认成机器 ${result.caught}/${result.total}`, '--', 'exams.md'], () => {}))
  return result
}

/** 最近的体检结果（不含今天），用来比较做法有没有用。 */
export function previousExams(home, limit = 5) {
  const md = join(home, 'exams.md')
  if (!existsSync(md)) return ''
  return readFileSync(md, 'utf8').split('\n').filter((l) => l.startsWith('## ') || /^被(看穿|认成机器)/.test(l)).slice(-limit * 2).join('\n')
}
