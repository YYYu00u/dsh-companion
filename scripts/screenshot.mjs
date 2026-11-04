// 用 Chrome DevTools Protocol 截图：桌面、手机、整页都行，不依赖 Playwright。
// 这是开发工具，不参与插件运行。
//
//   node scripts/screenshot.mjs --url http://127.0.0.1:4319/companion/ --out docs/images/home.jpg --width 1600 --height 900
//   node scripts/screenshot.mjs --url ... --out mobile.png --width 390 --height 844 --mobile
//
// 需要本机装了 Chrome。用 --chrome 指定别的路径。
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)

const url = arg('url', 'http://127.0.0.1:4319/companion/')
const out = arg('out', 'screenshot.png')
const width = Number(arg('width', 1600))
const height = Number(arg('height', 900))
const port = Number(arg('port', 9333))
const chromePath = arg('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
const userDir = mkdtempSync(join(tmpdir(), 'dsh-shot-'))

const chrome = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
  `--window-size=${width},${height}`,
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await sleep(150)
  }
  throw new Error('Chrome 没起来')
}

const page = await targets()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })

let nextId = 0
const waiters = new Map()
const events = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); return }
  const list = events.get(msg.method) ?? []
  events.set(msg.method, [])
  for (const fn of list) fn(msg.params)
})
function send(method, params = {}) {
  const id = ++nextId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => waiters.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result))))
}
function once(method, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${method} timeout`)), timeoutMs)
    const list = events.get(method) ?? []
    list.push((params) => { clearTimeout(timer); resolve(params) })
    events.set(method, list)
  })
}

try {
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 2, mobile: flag('mobile'),
  })
  const loaded = once('Page.loadEventFired')
  await send('Page.navigate', { url })
  await loaded
  await sleep(1200) // 页面自己的 fetch、字体、立绘
  const click = arg('click')
  if (click) {
    await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click)})?.click()` })
    await sleep(600)
  }
  if (flag('full')) {
    const metrics = await send('Page.getLayoutMetrics')
    const h = Math.ceil(metrics.cssContentSize.height)
    await send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: 2, mobile: flag('mobile') })
    await sleep(300)
  }
  const shot = await send('Page.captureScreenshot', { format: out.endsWith('.jpg') ? 'jpeg' : 'png', quality: out.endsWith('.jpg') ? 86 : undefined, captureBeyondViewport: true })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  const metrics = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({innerWidth, scrollWidth: document.documentElement.scrollWidth, body: document.body.scrollWidth})',
    returnByValue: true,
  })
  console.log(`${out} ${width}x${height} ${metrics.result.value}`)
} finally {
  ws.close()
  chrome.kill('SIGTERM')
  await sleep(200)
  try { rmSync(userDir, { recursive: true, force: true }) } catch {}
}
