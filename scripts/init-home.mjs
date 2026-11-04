// 第一次装：把一个人的家搭出来。插件第一次跑也会自动做，这个脚本方便提前改人设。
//
//   node scripts/init-home.mjs
//   node scripts/init-home.mjs --home ~/companion --name 小鲤
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ensureHome } from '../packages/core/config.js'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const raw = arg('home', join(homedir(), '.dsh-companion'))
const home = raw.replace(/^~(?=\/|$)/, homedir())
const name = arg('name', '小鲤')
ensureHome(home, { name })
console.log(`家搭好了：${home}`)
console.log('先改 persona.md（她是谁）、notebook.md（主人给我的设定），再启动 DSH。')
