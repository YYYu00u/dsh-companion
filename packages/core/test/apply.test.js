import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

function fakeCtx() {
  const tools = new Map()
  const sections = []
  return {
    sections,
    tools: {
      register(tool) { tools.set(tool.name, tool) },
      get(name) { return tools.get(name) },
    },
    systemPrompt: {
      section(s) { sections.push(s) },
      context(s) { sections.push(s) },
      suppressRuntimeContext() {},
      getSectionOrder() { return 0 },
    },
    on() {},
    get() {},
    effect(fn) { return fn() },
  }
}

test('apply 在空家上能起来，注册出核心工具和人设', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-apply-'))
  try {
    const ctx = fakeCtx()
    apply(ctx, { home, name: '测试鱼' })
    for (const name of ['take_note', 'fix_note', 'its_past', 'feel', 'write_diary', 'learn', 'grow', 'recall', 'look_back', 'use_hands']) {
      assert.ok(ctx.tools.get(name), `应该注册 ${name}`)
    }
    assert.ok(ctx.sections.length >= 2)
    const persona = ctx.sections.find((s) => s.name === 'deployment:persona-prefix')
    assert.ok(persona)
    assert.match(persona.text({}), /测试鱼/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
