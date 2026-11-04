// 把 workspace 里的包链到根 node_modules，这样不装 pnpm 也能跑测试。
// DSH 正式安装不需要这个脚本：插件管理器会把包 link 进 profile。
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packages = {
  '@dsh-companion/core': join(root, 'packages/core'),
  '@dsh-companion/web': join(root, 'packages/web'),
  '@dsh-companion/web-search-bing': join(root, 'packages/web-search-bing'),
  '@dsh-companion/window': join(root, 'packages/window'),
  '@dsh-companion/ears': join(root, 'packages/ears'),
}

for (const [name, dir] of Object.entries(packages)) {
  if (!existsSync(join(dir, 'package.json'))) throw new Error(`缺包：${dir}`)
  const target = join(root, 'node_modules', name)
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  symlinkSync(relative(dirname(target), dir), target, 'dir')
  console.log(`link ${name} -> ${dir}`)
}
