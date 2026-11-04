// 她的身体、技能、记忆三本索引。都是她家里的普通文件，进 git，换框架也能带走。
// 渐进披露（Anthropic Agent Skills 的做法）：每句话只带每样东西的一行，要细节再读全文。
// - 身体：body/<部位>/PART.md。第一行 `# 名字`，然后 `一句话：`、`需要：`（这个部位靠哪些工具）、`状态：`。
//   状态不信文件里写的：「需要」里的工具有一个不在，就算「没装好」。这样她不会以为自己有手却用不了。
// - 技能：skills/<名字>.md，手做成一件新事后写的做法。第一行 `# 名字`，第二行 `一句话：`。
// - 心愿单：body/wishlist.md，想做但做不到的事，主人看到了帮她装。
// - 记忆：日记、经历、梗本、本子里过去的事，不整段放进来，用 recall 搜。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readText, writeFileAtomic } from './mind.js'

const PART_ORDER = ['eyes', 'ears', 'mouth', 'legs', 'hands']
const field = (text, key) => (text.match(new RegExp(`^${key}[:：][ \\t]*(.*)$`, 'm'))?.[1] ?? '').trim()

/** 读一个 md 的开头：名字、一句话、需要、状态。 */
function head(file) {
  const t = readText(file, 4000)
  return { title: (t.match(/^#\s+(.+)$/m)?.[1] ?? '').trim(), one: field(t, '一句话'), needs: field(t, '需要').split(/[,，\s]+/).filter(Boolean), status: field(t, '状态'), text: t }
}

export function readParts(home) {
  const dir = join(home, 'body')
  if (!existsSync(dir)) return []
  const ids = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'PART.md'))).map((d) => d.name)
  ids.sort((a, b) => (PART_ORDER.indexOf(a) + 1 || 99) - (PART_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
  return ids.map((id) => ({ id, ...head(join(dir, id, 'PART.md')) }))
}

export function readSkills(home) {
  const dir = join(home, 'skills')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().map((f) => ({ id: f.slice(0, -3), ...head(join(dir, f)) }))
}

/** 心愿单「想要」那一节的条目。 */
export function readWishes(home) {
  const lines = readText(join(home, 'body/wishlist.md'), 20000).split('\n')
  const at = lines.findIndex((l) => l.trim() === '## 想要')
  if (at < 0) return []
  const out = []
  for (const l of lines.slice(at + 1)) {
    if (/^##\s/.test(l)) break
    if (l.startsWith('- ')) out.push(l.slice(2))
  }
  return out
}

/** has(name)：这个工具现在在不在。 */
export function bodyContext(home, has) {
  const parts = readParts(home)
  if (!parts.length) return ''
  const rows = parts.map((p) => {
    const missing = p.needs.filter((n) => !has(n))
    const status = missing.length ? '没装好，现在用不了' : p.status || '能用'
    return `- ${p.title}（${p.id}）：${p.one}${status === '能用' ? '' : `【${status}】`}`
  })
  const skills = readSkills(home)
  const wishes = readWishes(home)
  return [
    '你的身体（你就在主人这台电脑上，跟他用的是同一台电脑、同一个网。想知道某个部位的细节就用 look_body）：\n' + rows.join('\n'),
    skills.length ? '你的手学会的技能（交给手的时候提一句用哪个，手会照着做）：\n' + skills.map((s) => `- ${s.id}：${s.one || s.title}`).join('\n') : '',
    wishes.length ? `你的心愿单里有 ${wishes.length} 件想做还做不到的事，主人会看。` : '',
    '碰到做不到的事，先想想哪个部位能做；手能做的就交给手。真的哪个部位都做不到，就用 wish 记进心愿单，写清楚想做什么、卡在哪，别只说「没法子」。',
  ].filter(Boolean).join('\n\n')
}

/** 记忆索引：每样有多少，想不起来就搜。 */
export function memoryContext(home) {
  const diary = existsSync(join(home, 'diary')) ? readdirSync(join(home, 'diary')).filter((f) => f.endsWith('.md')).sort() : []
  const exp = readText(join(home, 'experiences.md'), 200000).split('\n').filter((l) => l.startsWith('- ')).length
  let slang = 0
  try { slang = JSON.parse(readFileSync(join(home, 'slang.json'), 'utf8')).length } catch {}
  const past = (readText(join(home, 'notebook.md'), 200000).split('## 过去的事')[1] ?? '').split('\n').filter((l) => l.startsWith('- ')).length
  const bits = [
    diary.length ? `日记 ${diary.length} 天（从 ${diary[0].slice(0, -3)} 开始）` : '',
    exp ? `经历 ${exp} 条` : '',
    slang ? `学来的说法 ${slang} 条` : '',
    past ? `本子里过去的事 ${past} 条` : '',
  ].filter(Boolean)
  return (bits.length ? `你的记忆里还有：${bits.join('、')}。上面没放全，想不起来、他问「你还记得…吗」的时候，用 recall 搜一下再说，别瞎编。` : '') +
    '你们聊过的原话都留着：想不起某次聊天的细节、他问「你那天怎么说的」，用 look_back 翻。'
}

// ---- recall：在她的记忆文件里找。中文没空格，按两个字一组算命中，命中多的排前面。
const grams = (s) => {
  const t = s.toLowerCase().replace(/[\s，。！？、,.!?：:；;「」"'（）()【】\[\]]+/g, ' ').trim()
  const out = new Set()
  for (const w of t.split(' ').filter(Boolean)) {
    if (w.length <= 2) out.add(w)
    for (let i = 0; i + 2 <= w.length; i++) out.add(w.slice(i, i + 2))
  }
  return [...out]
}

export function recall(home, query, max = 12) {
  const q = grams(String(query ?? ''))
  if (!q.length) throw new Error('query 写你想找的事，几个关键词就行')
  const pool = []
  const diaryDir = join(home, 'diary')
  if (existsSync(diaryDir)) for (const f of readdirSync(diaryDir).filter((f) => f.endsWith('.md'))) {
    for (const block of readText(join(diaryDir, f), 200000).split(/\n(?=\d{2}:\d{2})|\n\n+/)) if (block.trim() && !block.startsWith('# ')) pool.push({ from: `日记 ${f.slice(0, -3)}`, text: block.trim() })
  }
  for (const [file, from] of [['experiences.md', '经历'], ['notebook.md', '本子'], ['owner.md', '对他的了解'], ['self.md', '自己']]) {
    for (const l of readText(join(home, file), 200000).split('\n')) if (l.trim() && !l.startsWith('#')) pool.push({ from, text: l.replace(/^- /, '').trim() })
  }
  try { for (const s of JSON.parse(readFileSync(join(home, 'slang.json'), 'utf8'))) pool.push({ from: '学来的说法', text: `「${s.say}」${s.means}${s.when ? `；${s.when}` : ''}${s.dropped ? '（已经不用了）' : ''}` }) } catch {}
  try { for (const w of JSON.parse(readFileSync(join(home, 'wants.json'), 'utf8'))) pool.push({ from: '想做的事', text: `${w.on ?? ''} ${w.what}（${w.status}）` }) } catch {}
  const scored = pool.map((p) => {
    const low = p.text.toLowerCase()
    return { ...p, score: q.filter((g) => low.includes(g)).length }
  }).filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, max)
  if (!scored.length) return '没找到。可能真没发生过，或者换个说法再搜一次。'
  return scored.map((p) => `[${p.from}] ${p.text.length > 200 ? p.text.slice(0, 200) + '…' : p.text}`).join('\n')
}

// ---- 心愿单、技能：她和手都能写。
export function addWish(home, { what, stuck, maybe }) {
  const file = join(home, 'body/wishlist.md')
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  const line = `- ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${what}；卡在：${stuck}${maybe ? `；可能的办法：${maybe}` : ''}`
  const lines = (existsSync(file) ? readFileSync(file, 'utf8') : '# 心愿单\n\n## 想要\n\n## 装好了\n').replace(/\s+$/, '').split('\n')
  let at = lines.findIndex((l) => l.trim() === '## 想要')
  if (at < 0) { lines.push('', '## 想要'); at = lines.length - 1 }
  let end = lines.findIndex((l, i) => i > at && /^##\s/.test(l))
  if (end < 0) end = lines.length
  while (end - 1 > at && lines[end - 1].trim() === '') end--
  lines.splice(end, 0, line)
  writeFileAtomic(file, lines.join('\n') + '\n')
  return file
}

export const skillFile = (home, id) => join(home, 'skills', `${id}.md`)
export function saveSkill(home, { id, one, steps }) {
  if (!/^[\p{L}\p{N}_-]{1,30}$/u.test(id ?? '')) throw new Error('id 用 30 字以内的中文、字母、数字或横线，比如「论坛发帖」')
  if (!one?.trim() || !steps?.trim()) throw new Error('one 写一句话说这个技能干什么，steps 写具体步骤和坑')
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  const text = `# ${id}\n一句话：${one.trim()}\n更新：${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}\n\n${steps.trim()}\n`
  writeFileAtomic(skillFile(home, id), text)
  return skillFile(home, id)
}
