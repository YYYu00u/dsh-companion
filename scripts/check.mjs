// 开源前的体检：语法、包清单、私人路径、密钥、没写进 files 的 JS。
// 不跑测试（测试用 npm test），只查那些「上传了才发现」的问题。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const problems = []
const checked = []

const SKIP = new Set(['node_modules', '.git', '.chrome-shot', 'docs/images'])
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(root)
for (const file of files.filter((f) => extname(f) === '.js' || extname(f) === '.mjs')) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
    checked.push(file)
  } catch (error) {
    problems.push(`${relative(root, file)}: 语法错误\n${error.stderr?.toString().slice(0, 500)}`)
  }
}

// 私人路径、密钥、旧作用域
const FORBIDDEN = [
  [/\/Users\/[A-Za-z0-9._-]+/g, '本机绝对路径'],
  [/@local\//g, '旧的 @local 作用域'],
  [/sk-[A-Za-z0-9]{16,}/g, '疑似 API key'],
  [/BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/g, '私钥'],
  [new RegExp('dafei' + 'yu', 'gi'), '旧项目名'],
]
for (const file of files.filter((f) => ['.js', '.mjs', '.json', '.yml', '.yaml', '.md', '.html', '.css'].includes(extname(f)))) {
  if (file.includes('/CHANGELOG.md')) continue
  const text = readFileSync(file, 'utf8')
  for (const [re, label] of FORBIDDEN) {
    const hit = text.match(re)
    if (hit) problems.push(`${relative(root, file)}: 出现${label}：${[...new Set(hit)].slice(0, 3).join(', ')}`)
  }
}

// package.json：名字、许可证、files
for (const dir of readdirSync(join(root, 'packages'))) {
  const pkgFile = join(root, 'packages', dir, 'package.json')
  if (!existsSync(pkgFile)) continue
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  if (!pkg.name || !pkg.version) problems.push(`${dir}: package.json 缺 name/version`)
  if (pkg.license !== 'MIT') problems.push(`${dir}: license 应该是 MIT`)
  if (!pkg.files?.includes('index.js')) problems.push(`${dir}: files 里没有 index.js`)
  if (!pkg.dsh?.bundle?.patch) problems.push(`${dir}: 没有 dsh.bundle.patch`)
  const patch = join(root, 'packages', dir, pkg.dsh?.bundle?.patch ?? '')
  if (!existsSync(patch)) problems.push(`${dir}: bundle patch 不存在`)
  for (const file of readdirSync(join(root, 'packages', dir))) {
    if (file.endsWith('.js') && !file.startsWith('test') && !pkg.files?.includes(file)) {
      problems.push(`${dir}: ${file} 没写进 package.json 的 files`)
    }
  }
}

// README 语言切换：两个文件，各自顶部能点到对方
for (const [file, other] of [['README.md', 'README.zh-CN.md'], ['README.zh-CN.md', 'README.md']]) {
  const text = readFileSync(join(root, file), 'utf8')
  if (!text.includes(`href="${other}"`) && !text.includes(`](${other})`)) problems.push(`${file}: 顶部没有指向 ${other} 的语言链接`)
}

// 不该进仓库的运行数据
for (const bad of ['.data', 'node_modules/.cache']) {
  if (existsSync(join(root, bad))) problems.push(`仓库里有 ${bad}`)
}

console.log(`检查了 ${checked.length} 个 JS/MJS 文件`)
if (problems.length) {
  console.error(`\n${problems.length} 个问题：\n`)
  for (const p of problems) console.error(`- ${p}`)
  process.exit(1)
}
console.log('没有发现私人路径、密钥、旧作用域或包清单问题。')
