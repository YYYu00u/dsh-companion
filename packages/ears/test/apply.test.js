import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

test('ears apply 注册 listen_now / listen_file 和 ears 服务', () => {
  const tools = new Map()
  const services = new Map()
  const ctx = {
    tools: { register(tool) { tools.set(tool.name, tool) } },
    provide(name, value) { services.set(name, value) },
    logger: () => ({ info() {}, warn() {} }),
  }
  apply(ctx, { home: '/tmp/dsh-ears-test', stt: { model: '/tmp/x.bin' } })
  assert.ok(tools.has('listen_now'))
  assert.ok(tools.has('listen_file'))
  assert.ok(services.has('ears'))
  assert.equal(typeof services.get('ears').transcribeBuffer, 'function')
})

test('ears HTTP 路由：status、404、跨站 403', async () => {
  let handler
  const ctx = {
    tools: { register() {} },
    provide() {},
    logger: () => ({ info() {} }),
    effect(fn) { return fn() },
    get(name) { return name === 'webServer' ? { getOrigin: () => 'http://127.0.0.1:1', register(r) { handler = r.handler } } : undefined },
  }
  apply(ctx, { home: '/tmp/dsh-ears-http', helper: '/tmp/nope', stt: { sherpa: { model: '/tmp/nope.onnx', tokens: '/tmp/nope.txt' } }, menu: false })
  const call = async (method, url, body = '', headers = {}) => {
    const res = { status: 0, body: '', writeHead(s) { this.status = s }, end(b) { this.body = b } }
    await handler({ method, url, headers, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) } }, res)
    return { status: res.status, json: JSON.parse(res.body) }
  }
  assert.equal((await call('GET', '/ears/api/status')).json.ok, true)
  assert.equal((await call('GET', '/ears/api/nope')).status, 404)
  assert.equal((await call('POST', '/ears/api/listen', '{}', { 'sec-fetch-site': 'cross-site' })).status, 403)
})

test('桌宠菜单：点一下听，把文字发到那只宠物的 /chat', async () => {
  const { registerPetMenu } = await import('../index.js')
  const calls = []
  const label = '听我 1 秒'
  let done
  const finished = new Promise((ok) => { done = ok })
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body })
    const json = (value) => ({ json: async () => value })
    if (String(url).endsWith('/menu/item')) return json({ ok: true })
    if (String(url).includes('/menu/events')) return json({ ok: true, events: { [label]: 'pet-1' } })
    if (String(url).includes('/chat')) { done(); return json({ ok: true, reply: '嗯' }) }
    throw new Error('unexpected ' + url)
  }
  let cleanup
  const ctx = { effect(fn) { cleanup = fn(); return cleanup } }
  const service = { listenNow: async () => ({ text: '你在看视频' }) }
  registerPetMenu({ ctx, config: { menuLabel: label, menuSeconds: 1, menuOwner: 'test-ears' }, service, origin: () => 'http://fake', log: { info() {} } })
  try {
    await Promise.race([finished, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))])
    const chat = calls.find((c) => c.url.includes('/chat'))
    assert.ok(chat.url.includes('pet=pet-1'))
    assert.equal(JSON.parse(chat.body).text, '你在看视频')
  } finally {
    cleanup?.()
    globalThis.fetch = realFetch
  }
})

test('Host 模式没有 ctx.tools 也能加载（只注册 web/菜单）', () => {
  const services = new Map()
  const ctx = {
    provide(name, value) { services.set(name, value) },
    logger: () => ({ info() {} }),
    get() { return undefined },
    effect(fn) { return fn() },
  }
  assert.doesNotThrow(() => apply(ctx, { home: '/tmp/dsh-ears-host', menu: false }))
  assert.ok(services.has('ears'))
})
