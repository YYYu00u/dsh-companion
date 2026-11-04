// 从 DSH 宿主那棵 node_modules 里取 @deepseek-ai/* 包。
// 插件是 link 进 profile 的，宿主的包在 DSH 安装包里，裸 import 找不到。
// 找法按顺序试：DSH_HOST_MODULES、启动参数里的 runtimeDir、Electron 的 resourcesPath、开发时的 dsh 安装目录。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function candidateRoots() {
  const out = []
  const push = (p) => { if (p && !out.includes(p)) out.push(p) }
  push(process.env.DSH_HOST_MODULES)
  // 宿主进程启动时 argv[2] 是 runtimeDir（dsh-desktop-host 的 main()）
  if (process.argv[2]) push(join(process.argv[2], 'node_modules', '@deepseek-ai'))
  // Electron：/Applications/.../Resources/app.asar/dsh/node_modules/@deepseek-ai
  if (process.resourcesPath) push(join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai'))
  return out
}

function entryOf(root, name) {
  const dir = join(root, name)
  const pkgFile = join(dir, 'package.json')
  if (!existsSync(pkgFile)) return undefined
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  const dot = pkg.exports?.['.']
  const rel = typeof dot === 'string' ? dot : dot?.import ?? dot?.default ?? pkg.module ?? pkg.main
  const file = rel && join(dir, String(rel).replace(/^\.\//, ''))
  return file && existsSync(file) ? pathToFileURL(file).href : undefined
}

/** import 宿主里的一个 @deepseek-ai 包（name 不带 scope，比如 'dsh-compaction-basic'）。 */
export async function hostImport(name) {
  try { return await import(`@deepseek-ai/${name}`) } catch {}
  const fails = []
  for (const root of candidateRoots()) {
    const url = entryOf(root, name)
    if (!url) continue
    try { return await import(url) } catch (e) { fails.push(`${root}: ${e?.code ?? e}`) }
  }
  throw new Error(`找不到宿主的 @deepseek-ai/${name}（${fails.join('；') || '候选目录都没有'}）`)
}
