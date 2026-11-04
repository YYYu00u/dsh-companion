import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

test('web apply 在空家上能起来，不依赖 DSH 会话', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-web-'))
  try {
    const effects = []
    const log = { info() {}, warn() {}, error() {} }
    const ctx = {
      effect(fn) { effects.push(fn); return () => {} },
      on() {},
      get() {},
      logger: () => log,
      webServer: { register() {}, getOrigin: () => 'http://127.0.0.1:1' },
      sessionController: { create: async () => ({ sessionId: 's1' }), resolveAgent: async () => undefined },
      workingDirectory: { get: () => home, set: async () => {} },
      llm: {},
    }
    apply(ctx, { home, name: '测试鱼', modules: [], port: 0 })
    assert.ok(effects.length >= 1)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
