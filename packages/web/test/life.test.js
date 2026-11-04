import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ownPrompt } from '../life.js'

test('自己的时间：随机冒一个念头，不是固定清单', () => {
  const a = ownPrompt(new Date('2026-01-01T15:00:00'), { wants: [{ id: 'w1', what: '听歌' }], random: () => 0 })
  const b = ownPrompt(new Date('2026-01-01T15:00:00'), { random: () => 0.99 })
  assert.notEqual(a, b)
  assert.match(a, /下午 15:00/)
  assert.match(a, /听歌/)
  assert.match(a, /不要给主人发消息/)
})

test('失败的一轮不算数：次数退回去，惦记的事重新挂上', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-life-'))
  try {
    mkdirSync(join(home, '.data/mind'), { recursive: true })
    writeFileSync(join(home, '.data/mind/life.json'), JSON.stringify({
      date: new Date().toISOString().slice(0, 10), count: 2, own: 1, unanswered: 1,
      pending: { kind: 'nudge' },
    }))
    writeFileSync(join(home, 'reminders.json'), JSON.stringify([{ id: 'r1', what: '问他面试', when: '2026-01-01 10:00', done: true }]))
    const { createLife } = await import('../life.js')
    const life = createLife({ home, say: async () => {}, chat: () => ({ ready: true, busy: false }), reflect: async () => {}, log: {}, modules: [] })
    life.onTurnEnd('error')
    const snap = life.snapshot()
    assert.equal(snap.count, 1)
    assert.equal(snap.unanswered, 0)
    assert.equal(snap.own, 1)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
