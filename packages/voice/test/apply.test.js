import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply } from '../index.js'

/** 假 ctx：记下注册的路由，不起真服务 */
function fakeCtx(prefixes) {
  const effects = []
  return {
    effects,
    ctx: {
      effect(fn) { effects.push(fn); const stop = fn(); return () => stop?.() },
      logger: () => ({ info() {}, warn() {}, error() {} }),
      webServer: { register(route) { prefixes.push(route) }, getOrigin: () => 'http://127.0.0.1:1' },
    },
  }
}

function call(handler, method, url, body) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      on(event, fn) {
        if (event === 'data' && body) fn(Buffer.from(JSON.stringify(body)))
        if (event === 'end') fn()
        return req
      },
      destroy() {},
    }
    const chunks = []
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(code, headers) { this.statusCode = code; this.headers = headers ?? {} },
      end(buf) { if (buf) chunks.push(Buffer.from(buf)); resolve({ status: this.statusCode, headers: this.headers, body: Buffer.concat(chunks).toString('utf8') }) },
    }
    handler(req, res)
  })
}

test('voice apply：注册 /companion-voice，不启动引擎时不 spawn', () => {
  const prefixes = []
  const { ctx, effects } = fakeCtx(prefixes)
  apply(ctx, { start: false })
  assert.equal(prefixes.length, 1)
  assert.equal(prefixes[0].path, '/companion-voice')
  assert.equal(effects.length, 1, '只有注册路由这一个 effect')
})

test('GET /companion-voice/api/voices：回清单和默认音色', async () => {
  const prefixes = []
  const { ctx } = fakeCtx(prefixes)
  apply(ctx, { start: false })
  const r = await call(prefixes[0].handler, 'GET', '/companion-voice/api/voices')
  assert.equal(r.status, 200)
  const body = JSON.parse(r.body)
  assert.ok(body.voices.length >= 5)
  assert.ok(body.voices.every((v) => v.url.startsWith('/companion-voice/api/voice/')))
  assert.ok(body.voices.some((v) => v.id === body.default))
})

test('POST /api/voices/default：写进 stateDir，非法 id 拒绝', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-voice-'))
  try {
    const prefixes = []
    const { ctx } = fakeCtx(prefixes)
    apply(ctx, { start: false, stateDir: dir })
    const h = prefixes[0].handler

    const bad = await call(h, 'POST', '/companion-voice/api/voices/default', { id: 'nope' })
    assert.equal(bad.status, 400)

    const ok = await call(h, 'POST', '/companion-voice/api/voices/default', { id: 'zh_female_roumeinvyou_uranus_bigtts' })
    assert.equal(ok.status, 200)
    assert.equal(JSON.parse(readFileSync(join(dir, 'voice.json'), 'utf8')).default, 'zh_female_roumeinvyou_uranus_bigtts')

    const list = JSON.parse((await call(h, 'GET', '/companion-voice/api/voices')).body)
    assert.equal(list.default, 'zh_female_roumeinvyou_uranus_bigtts')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('选品页：/companion-voice 会补斜杠再给 HTML', async () => {
  const prefixes = []
  const { ctx } = fakeCtx(prefixes)
  apply(ctx, { start: false })
  const redirect = await call(prefixes[0].handler, 'GET', '/companion-voice')
  assert.equal(redirect.status, 302)
  const page = await call(prefixes[0].handler, 'GET', '/companion-voice/')
  assert.equal(page.status, 200)
  assert.match(page.body, /她的嗓子/)
})
