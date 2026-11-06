// 插件入口：起本地合成服务，并把它的 HTTP 面挂到 DSH 上（/companion-voice/）。
// 没装模型、没生成参考音频、Python 起不来，都只是「没声音」，不影响别的插件。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVoiceEngine } from './src/engine.js'
import { readVoices, voiceFile } from './src/voices.js'

export const name = 'companion-voice'
export const inject = ['webServer']

const PKG = dirname(fileURLToPath(import.meta.url))
const PAGE = join(PKG, 'page', 'voices.html')

const sendJson = (res, status, body) => {
  const buf = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length })
  res.end(buf)
}

const readBody = (req, limit = 64 * 1024) => new Promise((resolve, reject) => {
  let size = 0
  const chunks = []
  req.on('data', (c) => {
    size += c.length
    if (size > limit) { reject(new Error('请求体太大')); req.destroy(); return }
    chunks.push(c)
  })
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  req.on('error', reject)
})

export function apply(ctx, config = {}) {
  const log = typeof ctx.logger === 'function' ? ctx.logger('companion-voice') : (ctx.logger ?? console)
  const { voices } = readVoices()
  if (!voices.length) { log.warn?.('voice: assets/voices.json 是空的，语音关着'); return }

  const stateDir = config.stateDir ?? join(homedir(), '.dsh-companion')
  const stateFile = join(stateDir, 'voice.json')
  const readDefault = () => {
    try { return JSON.parse(readFileSync(stateFile, 'utf8')).default ?? '' } catch { return '' }
  }
  const pick = (id) => (voices.some((v) => v.id === id) ? id : (readDefault() || voices[0].id))

  const engine = createVoiceEngine({ log, port: config.port ?? 4321, modelDir: config.modelDir ?? '', steps: config.steps })
  engine.defaultVoice = config.voice ?? ''
  if (config.start !== false) ctx.effect(() => {
    engine.start().catch((e) => log.warn?.(`voice: ${e.message}`))
    return () => engine.stop()
  })

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname.replace(/^\/companion-voice/, '') || '/'

    if (req.method === 'GET' && (path === '/' || path === '')) {
      if (!url.pathname.endsWith('/')) { res.writeHead(302, { location: `${url.pathname}/` }); return res.end() }
      if (!existsSync(PAGE)) return sendJson(res, 404, { error: '没有选品页' })
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' })
      return res.end(readFileSync(PAGE))
    }

    if (path === '/api/voices' && req.method === 'GET') {
      const { text } = readVoices()
      return sendJson(res, 200, {
        text,
        ready: engine.ready,
        default: pick(''),
        voices: voices.map((v) => ({ ...v, url: `/companion-voice/api/voice/${v.id}` })),
      })
    }

    if (path === '/api/voices/default' && req.method === 'POST') {
      try {
        const body = JSON.parse((await readBody(req)) || '{}')
        if (!voices.some((v) => v.id === body.id)) return sendJson(res, 400, { error: '没有这个音色' })
        mkdirSync(stateDir, { recursive: true })
        writeFileSync(stateFile, JSON.stringify({ default: body.id }, null, 1))
        return sendJson(res, 200, { ok: true, default: body.id })
      } catch (e) { return sendJson(res, 400, { error: String(e.message ?? e) }) }
    }

    const hit = path.match(/^\/api\/voice\/([a-z0-9_]+)$/)
    if (hit && req.method === 'GET') {
      const file = voiceFile(hit[1])
      if (!file) return sendJson(res, 404, { error: '没有这个音色的参考音频（先跑 npm run refs）' })
      res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-cache' })
      return res.end(readFileSync(file))
    }

    if (path === '/api/say' && req.method === 'POST') {
      let body = {}
      try { body = JSON.parse((await readBody(req)) || '{}') } catch { return sendJson(res, 400, { error: '请求体不是 JSON' }) }
      const text = String(body.text ?? '').trim().slice(0, 400)
      if (!text) return sendJson(res, 400, { error: '没有文字' })
      try {
        const wav = await engine.say(text, pick(body.voice))
        res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' })
        return res.end(wav)
      } catch (e) { return sendJson(res, 503, { error: `念不出来：${String(e.message ?? e)}` }) }
    }

    return sendJson(res, 404, { error: 'not found' })
  }

  const webServer = ctx.webServer
  if (webServer?.register) ctx.effect(() => webServer.register({ kind: 'prefix', path: '/companion-voice', handler: route }))
}
