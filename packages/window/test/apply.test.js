import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

test('window apply 在空家上能起来，不依赖 DSH 窗口', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-window-'))
  try {
    const effects = []
    const ctx = {
      effect(fn) { effects.push(fn); return () => {} },
      webServer: { register() {}, getOrigin: () => 'http://127.0.0.1:1' },
      logger: () => ({ info() {}, warn() {} }),
    }
    apply(ctx, { home, name: '测试鱼', chatBase: '/companion' })
    assert.ok(effects.length >= 2)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
