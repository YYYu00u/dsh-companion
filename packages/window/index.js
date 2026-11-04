// 大肥鱼的聊天窗（Host 级插件）：像 QQ 的单独聊天窗口，从桌宠右键「更多 / 和她聊天」打开。
// - 页面：挂在 DSH 端口的 /companion-window/，聊天用的还是网页插件（@dsh-companion/web）的 /companion/api/*，所以聊天记录是同一份。
// - 窗口：用桌宠自带的 Electron（~/.dsh/electron/Electron.app）跑 app/main.js，开一个独立的应用窗口，不是浏览器。
//   起不来就退回 Chrome 的 --app 小窗，再不行用默认浏览器。
// - 桌宠菜单：dsh-pet 的第三方菜单接口（API 第六节）：注册一项，长轮询等它被点；DSH 重启菜单会清空，插件会重新注册。
// 关掉这个插件，网页插件和桌宠都不受影响。
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureHome, resolveHome } from '@dsh-companion/core/config'

export const name = 'dsh-companion-window'
export const inject = ['webServer']

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = join(HERE, 'public')
const APP = join(HERE, 'app')
const BASE = '/companion-window'
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

export function apply(ctx, config = {}) {
  const log = typeof ctx.logger === 'function' ? ctx.logger('dsh-companion-window') : (ctx.logger ?? console)
  const home = resolveHome(config)
  ensureHome(home, { name: config.name ?? '大肥鱼' })
  // 聊天接口在哪：网页插件挂在 DSH 端口上的路径（默认 /companion）。页面和接口同一个端口，不用跨域。
  const chatBase = String(config.chatBase ?? '/companion').replace(/\/+$/, '')
  if (!/^\/[\w/-]+$/.test(chatBase)) throw new Error('dsh-companion-window: chatBase 要是 /companion 这种路径')
  const origin = () => ctx.webServer.getOrigin()

  // ---- 页面：index.html、qq.js、qq.css。页面里写了 <base href="<chatBase>/">，图（立绘、头像）和接口（api/*）都从网页插件那边拿；
  // 自己的 js、css 用绝对路径 /companion-window/...。
  function serve(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname.slice(BASE.length) || '/'
    if (req.method !== 'GET') { res.writeHead(405); return res.end() }
    if (path === '/' && !req.url.split('?')[0].endsWith('/')) { res.writeHead(302, { location: `${BASE}/` }); return res.end() }
    const file = path === '/' ? 'index.html' : path.slice(1)
    if (!/^[\w.-]+$/.test(file) || !existsSync(join(PAGE, file))) { res.writeHead(404); return res.end('not found') }
    res.writeHead(200, { 'content-type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
    const body = readFileSync(join(PAGE, file))
    res.end(file === 'index.html' ? body.toString('utf8').replace('__CHAT_BASE__', `${chatBase}/`) : body)
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE, handler: serve }))

  // ---- 开窗口
  const ELECTRON = config.electron ?? join(homedir(), '.dsh/electron/Electron.app/Contents/MacOS/Electron')
  const openInBrowser = (url) => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const [cmd, args] = existsSync(chrome)
      ? [chrome, [`--app=${url}`, '--window-size=780,680', `--user-data-dir=${join(home, '.data/chat-window-chrome')}`, '--no-first-run', '--no-default-browser-check']]
      : ['open', [url]]
    execFile(cmd, args, () => {})
  }
  function openChat() {
    const url = `${origin()}${BASE}/`
    if (!existsSync(ELECTRON)) return openInBrowser(url)
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE // DSH 自己是用 Electron 当 node 跑的，这个变量会让子进程也变成 node
    const startedAt = Date.now()
    const child = spawn(ELECTRON, [APP, `--url=${url}`, `--data=${join(home, '.data/chat-window')}`, `--name=${config.name ?? '大肥鱼'}`], { env, detached: true, stdio: 'ignore' })
    child.on('error', () => openInBrowser(url))
    // 一启动就挂了（比如系统不让开沙箱）：退回浏览器小窗。正常关窗口退出的不算。
    child.on('exit', (code, signal) => { if ((code || signal) && Date.now() - startedAt < 5000) { log.info?.('chat window failed, fallback to browser', code ?? signal); openInBrowser(url) } })
    child.unref()
  }

  // ---- 桌宠右键「更多 / 和她聊天」
  const OWNER = config.menuOwner ?? config.name ?? '大肥鱼'
  const LABEL = config.menuLabel ?? '和她聊天'
  ctx.effect(() => {
    let stopped = false
    const pet = (path, init) => fetch(`${origin()}/dsh-pet-7340${path}`, init).then((r) => r.json())
    ;(async () => {
      let backoff = 2000
      while (!stopped) {
        try {
          const reg = await pet('/menu/item', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner: OWNER, labels: [LABEL], target: 'desktop' }) })
          if (!reg.ok) throw new Error(reg.reason ?? 'register failed')
          backoff = 2000
          while (!stopped) {
            const r = await pet(`/menu/events?owner=${encodeURIComponent(OWNER)}&wait=10000`)
            if (!r.ok) break // unknown-owner：宿主重启过，回去重新注册
            if (r.events?.[LABEL]) openChat()
          }
        } catch (error) {
          log.info?.('pet menu not ready', String(error?.message ?? error))
          await new Promise((ok) => setTimeout(ok, backoff))
          backoff = Math.min(60_000, backoff * 2)
        }
      }
    })()
    return () => {
      stopped = true
      pet(`/menu/item?owner=${encodeURIComponent(OWNER)}`, { method: 'DELETE' }).catch(() => {})
    }
  })
}
