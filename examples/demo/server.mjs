// 不装 DSH 也能看界面：起一个只读的演示服务器，用内存里的假数据喂真实的网页。
//
//   node examples/demo/server.mjs            # http://127.0.0.1:4319/companion/
//   PORT=8080 node examples/demo/server.mjs
//
// 它不读任何人的 home，不发模型请求。发消息只会收到几条写死的回复。
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as demo from './data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, '../../packages/web/public')
const WINDOW = join(HERE, '../../packages/window/public')
const PORT = Number(process.env.PORT ?? 4319)
const BASE = '/companion'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
}
const SAFE = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' }
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

const crossSite = (req) => ['cross-site', 'same-site'].includes(req.headers['sec-fetch-site'])

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SAFE })
  res.end(JSON.stringify(body))
}

const clients = new Set()
const push = (payload) => { const line = `data: ${JSON.stringify(payload)}\n\n`; for (const res of clients) res.write(line) }

const STICKERS = { 开心: 'art-face-happy.jpg', 哼: 'art-face-sulk.jpg', 困: 'art-face-sleepy.jpg' }

function readBody(req, limit = 7 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (c) => { raw += c; if (raw.length > limit) reject(new Error('too large')) })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function mind() {
  return {
    mood: demo.mood, moodLog: demo.moodLog, reminders: demo.reminders, diary: demo.diary, moments: demo.moments,
    lessons: demo.lessons, exams: demo.exams, proposals: demo.proposals, wants: demo.wants, experiences: demo.experiences,
    sensed: demo.sensed, owner: demo.owner, knows: demo.knows, doing: demo.doing, life: demo.life,
    body: demo.body, skills: demo.skills, wishes: demo.wishes,
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  if (path === '/' || path === '/companion') {
    res.writeHead(302, { location: `${BASE}/` })
    return res.end()
  }

  // 聊天窗页面的演示：同一个假后端，只把 <base> 指到 /companion/
  if (path === '/companion-window' || path.startsWith('/companion-window/')) {
    const rel = path.slice('/companion-window'.length + 1) || 'index.html'
    const file = normalize(join(WINDOW, rel))
    if (rel.includes('..') || !file.startsWith(WINDOW) || !existsSync(file)) return json(res, 404, { error: 'not found' })
    const body = readFileSync(file)
    res.writeHead(200, {
      'content-type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream',
      'cache-control': 'no-cache', 'content-security-policy': CSP, ...SAFE,
    })
    return res.end(rel === 'index.html' ? body.toString('utf8').replace('__CHAT_BASE__', `${BASE}/`) : body)
  }

  if (path.startsWith(`${BASE}/api/`)) {
    if (req.method !== 'GET' && crossSite(req)) return json(res, 403, { error: '只接受本页发来的请求' })
    const api = path.slice(BASE.length)

    if (api === '/api/who') return json(res, 200, demo.who)
    if (api === '/api/history') return json(res, 200, { rows: demo.rows, busy: false })
    if (api === '/api/mind') return json(res, 200, mind())
    if (api === '/api/stickers') return json(res, 200, { stickers: Object.keys(STICKERS) })
    if (api === '/api/level' && req.method === 'GET') return json(res, 200, { ...demo.level, levels: [
      { name: '只聊天', desc: '你找她她才说话' }, { name: '省着点', desc: '到点提醒，晚上写日记' },
      { name: '平常', desc: '有体检，一天 2 段自己的时间' }, { name: '活泼', desc: '一天 4 段自己的时间' }, { name: '全开', desc: '一天 6 段自己的时间' },
    ] })
    if (api === '/api/level' && req.method === 'POST') return json(res, 200, demo.level)
    if (api === '/api/reflect') return json(res, 202, { ok: true })
    if (api === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive', ...SAFE })
      res.write(': hi\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    if (api === '/api/send' && req.method === 'POST') {
      let body
      try { body = JSON.parse((await readBody(req)) || '{}') } catch { return json(res, 400, { error: '请求看不懂' }) }
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return json(res, 400, { error: '消息是空的' })
      const seq = `m${Date.now()}`
      push({ type: 'row', row: { seq, time: Date.now(), side: 'me', text } })
      const reply = demo.replies[Math.floor(Math.random() * demo.replies.length)]
      push({ type: 'typing' })
      reply.forEach((line, i) => setTimeout(() => {
        push({ type: 'row', row: { seq: `${seq}.${i}`, time: Date.now(), side: 'her', text: line } })
        if (i === reply.length - 1) push({ type: 'idle', reason: 'completed' })
      }, 700 + i * 900))
      return json(res, 200, { ok: true })
    }
    const sticker = api.match(/^\/api\/sticker\/(.+)$/)
    if (sticker) {
      const file = STICKERS[decodeURIComponent(sticker[1])]
      if (!file) return json(res, 404, { error: 'not found' })
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600', ...SAFE })
      return res.end(readFileSync(join(PUBLIC, file)))
    }
    return json(res, 404, { error: 'not found' })
  }

  // 静态页面
  const rel = path.slice(BASE.length + 1) || 'index.html'
  if (rel.includes('..') || !/^[\w./-]+$/.test(rel)) return json(res, 404, { error: 'not found' })
  const file = normalize(join(PUBLIC, rel))
  if (!file.startsWith(PUBLIC) || !existsSync(file)) return json(res, 404, { error: 'not found' })
  res.writeHead(200, {
    'content-type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream',
    'cache-control': 'no-cache', 'content-security-policy': CSP, ...SAFE,
  })
  res.end(readFileSync(file))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`demo: http://127.0.0.1:${PORT}${BASE}/`)
})
