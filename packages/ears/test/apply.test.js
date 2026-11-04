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
