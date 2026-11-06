#!/usr/bin/env node
// 扩展清单：读 extensions.json，校验格式，并报告每个扩展在这台机器上"装没装、模型在不在"。
//
//   node scripts/extensions.mjs list      看清单和本机状态
//   node scripts/extensions.mjs check     只校验清单（CI 用）
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const MANIFEST = join(ROOT, 'extensions.json')
const HEX64 = /^[a-f0-9]{64}$/

export function load(file = MANIFEST) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  return raw
}

/** 返回问题列表；空数组表示清单健康。 */
export function validate(manifest, root = ROOT) {
  const problems = []
  if (manifest.schema !== 1) problems.push(`schema 应该是 1，实际 ${manifest.schema}`)
  const list = manifest.extensions
  if (!Array.isArray(list) || !list.length) { problems.push('extensions 不能为空'); return problems }

  const ids = new Set()
  for (const [i, e] of list.entries()) {
    const at = `extensions[${i}]${e.id ? `(${e.id})` : ''}`
    if (!e.id || !/^[a-z0-9-]+$/.test(e.id)) problems.push(`${at}: id 只能是小写字母、数字、横线`)
    else if (ids.has(e.id)) problems.push(`${at}: id 重复`)
    else ids.add(e.id)
    for (const key of ['name', 'summary', 'status', 'path']) if (!e[key]) problems.push(`${at}: 缺 ${key}`)
    if (e.path && !existsSync(join(root, e.path))) problems.push(`${at}: 路径不存在 ${e.path}`)

    // 有 package 的，包名要和 package.json 对得上
    if (e.package) {
      const pkgFile = join(root, e.path, 'package.json')
      if (!existsSync(pkgFile)) problems.push(`${at}: 没有 package.json`)
      else {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
        if (pkg.name !== e.package) problems.push(`${at}: 包名不符（清单 ${e.package}，实际 ${pkg.name}）`)
      }
    }
    for (const d of e.downloads ?? []) {
      if (!d.id || !d.url) problems.push(`${at}: download 缺 id 或 url`)
      if (d.sha256 && !HEX64.test(d.sha256)) problems.push(`${at}/${d.id}: sha256 不是 64 位十六进制`)
      for (const f of d.files ?? []) {
        if (!f.path || !f.sha256) problems.push(`${at}/${d.id}: files 项缺 path 或 sha256`)
        else if (!HEX64.test(f.sha256)) problems.push(`${at}/${d.id}/${f.path}: sha256 格式不对`)
      }
    }
  }
  return problems
}

const expand = (p) => (p.startsWith('~/') ? join(process.env.HOME ?? '', p.slice(2)) : p)

/** 这台机器上的状态：包在不在、模型下没下。 */
export function status(manifest, root = ROOT) {
  return manifest.extensions.map((e) => {
    const packaged = Boolean(e.package) && existsSync(join(root, e.path, 'package.json'))
    const models = (e.downloads ?? []).map((d) => {
      const into = (d.into ?? '').replace(/^\.\//, '')
      const base = into.startsWith('~') ? expand(into) : join(root, e.path, into)
      return { id: d.id, exists: Boolean(into) && existsSync(base) }
    })
    return { id: e.id, name: e.name, packaged, models }
  })
}

function list() {
  const m = load()
  const problems = validate(m)
  const rows = status(m)
  console.log('扩展'.padEnd(10), '包'.padEnd(4), '模型')
  for (const e of m.extensions) {
    const s = rows.find((r) => r.id === e.id)
    const pack = e.status === 'external' ? '外部' : s.packaged ? '✓' : '✗'
    const dl = s.models.length ? s.models.map((x) => `${x.id}:${x.exists ? '在' : '缺'}`).join('  ') : '—'
    console.log(e.name.padEnd(8), pack.padEnd(2), dl)
  }
  console.log(`\n基础（core + web）不在这张表里：装完就能聊。`)
  if (problems.length) { console.error('\n清单有问题：'); for (const p of problems) console.error(' -', p); process.exitCode = 1 }
}

const cmd = process.argv[2] ?? 'list'
if (cmd === 'check') {
  const problems = validate(load())
  if (problems.length) { for (const p of problems) console.error(' -', p); process.exit(1) }
  console.log('extensions.json 没问题')
} else if (cmd === 'list') {
  list()
} else {
  console.error(`未知命令：${cmd}（可用 list / check）`)
  process.exit(2)
}
