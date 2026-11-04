import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeMemory, dayOf, openMemory, retention, searchEpisodes, splitIntoBouts, strengthOf, tokenize } from '../memory/store.js'

test('中文按两个字切，英文数字整词', () => {
  assert.deepEqual(tokenize('面试'), ['面试'])
  assert.ok(tokenize('明天面试').includes('面试'))
  assert.ok(tokenize('GPT-5 很好').includes('gpt-5'))
  assert.ok(!tokenize('我们今天').includes('我们'))
})

test('凌晨 4 点分界：23:50 和 00:10 算同一天', () => {
  const a = new Date('2026-01-01T23:50:00').getTime()
  const b = new Date('2026-01-02T00:10:00').getTime()
  assert.equal(dayOf(a), dayOf(b))
  const c = new Date('2026-01-02T04:10:00').getTime()
  assert.notEqual(dayOf(b), dayOf(c))
})

test('切段：隔 30 分钟、跨天、满 40 条都断开', () => {
  const t = (min, text = 'x') => ({ at: new Date(`2026-01-01T10:${String(min).padStart(2, '0')}:00`).getTime(), who: '他', text })
  assert.equal(splitIntoBouts([t(0), t(10), t(50)]).length, 2)
  assert.equal(splitIntoBouts(Array.from({ length: 41 }, (_, i) => ({ at: 1000 * i, who: '他', text: `第${i}句` }))).length, 2)
})

test('检索按相关度找回经历，并被想起来后记得更牢', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-mem-'))
  try {
    const mem = openMemory(home)
    const now = new Date('2026-01-10T12:00:00').getTime()
    mem.putEpisode({
      id: 'e1', from: now - 3600_000, to: now, title: '聊面试', gist: '他说周三要去面试，有点紧张',
      keywords: ['面试', '紧张'], importance: 4, emotion: 1,
    })
    mem.putEpisode({
      id: 'e2', from: now - 2 * 86400_000 - 3600_000, to: now - 2 * 86400_000, title: '吃饭', gist: '他说晚饭吃了白米饭',
      keywords: ['晚饭', '米饭'], importance: 1, emotion: 0,
    })
    const hit = mem.search('面试紧张吗', { now })
    assert.equal(hit[0].e.id, 'e1')
    const before = retention(mem.getEpisode('e2'), now)
    mem.noteRecalled(['e2'], '米饭', now)
    const after = retention(mem.getEpisode('e2'), now)
    assert.ok(after > before, '被想起来以后应该更牢')
    assert.ok(strengthOf({ importance: 5 }) > strengthOf({ importance: 1 }))
  } finally {
    closeMemory(home)
    rmSync(home, { recursive: true, force: true })
  }
})
