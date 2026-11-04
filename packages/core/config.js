// 一个「家」就是一个人的生活：人设、本子、日记、记忆、表情包、状态。
// 这里只做三件事：把配置里的路径摊开、找不到家就建一个空家、给出共同的默认值。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_NAME = '大肥鱼'
export const DEFAULT_HOME_DIR = '.dsh-companion'

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), 'templates')

/** 把 `~`、相对路径摊成绝对路径。相对路径按 DSH 进程的工作目录算。 */
export function expandPath(value, base = process.cwd()) {
  if (typeof value !== 'string') return undefined
  const p = value.trim()
  if (!p) return undefined
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return isAbsolute(p) ? p : resolve(base, p)
}

/**
 * 她的家。优先 config.home；兼容老配置：只给了 notebook 就用它所在目录；
 * 都没给就用工作目录下的 .dsh-companion。
 */
export function resolveHome(config = {}, base = process.cwd()) {
  return expandPath(config.home, base) ?? (config.notebook ? dirname(expandPath(config.notebook, base)) : join(homedir(), DEFAULT_HOME_DIR))
}

export function resolveNotebook(config, home) {
  if (!config.notebook) return join(home, 'notebook.md')
  const p = config.notebook
  return p.startsWith('~') || isAbsolute(p) ? expandPath(p) : join(home, p)
}

export function resolvePersona(config, home) {
  if (!config.persona) return join(home, 'persona.md')
  const p = config.persona
  return p.startsWith('~') || isAbsolute(p) ? expandPath(p) : join(home, p)
}

/** 读模板文件，把 {{name}} 换掉。 */
export function template(name, vars = {}) {
  const file = join(TEMPLATES, name)
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

const SEED_FILES = [
  'persona.md',
  'notebook.md',
  'standard.md',
  'self.md',
  'owner.md',
  'experiences.md',
  'moments.md',
]

const SEED_JSON = {
  'lessons.json': [],
  'reminders.json': [],
  'wants.json': [],
  'slang.json': [],
}

const SEED_DIRS = ['diary', 'skills', 'stickers', 'body', '.data', '.data/mind', '.data/memory', '.data/stickers-in']

/**
 * 第一次跑的时候把家搭起来：该有的文件都有，不该有的（已经有内容）一个都不碰。
 * 这样克隆仓库、装好插件、第一次打开就能聊，不用先手动抄一堆空文件。
 */
export function ensureHome(home, { name = DEFAULT_NAME } = {}) {
  if (!home) throw new Error('dsh-companion: 没有家（config.home）')
  mkdirSync(home, { recursive: true })
  for (const dir of SEED_DIRS) mkdirSync(join(home, dir), { recursive: true })

  const vars = { name, date: new Date().toISOString().slice(0, 10) }
  for (const file of SEED_FILES) {
    const target = join(home, file)
    if (existsSync(target)) continue
    const body = template(file, vars)
    if (body) writeFileSync(target, body, 'utf8')
  }
  for (const [file, value] of Object.entries(SEED_JSON)) {
    const target = join(home, file)
    if (!existsSync(target)) writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }

  const bodyParts = ['eyes', 'ears', 'mouth', 'legs', 'hands']
  for (const part of bodyParts) {
    const dir = join(home, 'body', part)
    mkdirSync(dir, { recursive: true })
    const target = join(dir, 'PART.md')
    if (!existsSync(target)) {
      const body = template(`body-${part}.md`, vars)
      if (body) writeFileSync(target, body, 'utf8')
    }
  }
  const bodyReadme = join(home, 'body', 'README.md')
  if (!existsSync(bodyReadme)) writeFileSync(bodyReadme, template('body-README.md', vars), 'utf8')
  const wishlist = join(home, 'body', 'wishlist.md')
  if (!existsSync(wishlist)) writeFileSync(wishlist, template('wishlist.md', vars), 'utf8')
  const skillsReadme = join(home, 'skills', 'README.md')
  if (!existsSync(skillsReadme)) writeFileSync(skillsReadme, template('skills-README.md', vars), 'utf8')

  // 运行状态不进 git：密钥、原话档案、心情、额度都在 .data 里。
  const gitignore = join(home, '.gitignore')
  if (!existsSync(gitignore)) writeFileSync(gitignore, '.data/\n', 'utf8')
  return home
}

/** 名字、时区这类共同默认值。 */
export function companionConfig(config = {}) {
  return {
    name: typeof config.name === 'string' && config.name.trim() ? config.name.trim() : DEFAULT_NAME,
    timeZone: typeof config.timeZone === 'string' && config.timeZone.trim() ? config.timeZone.trim() : Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}
