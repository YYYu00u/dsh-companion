import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDelivery, gapBefore, partOf, splitReply, typoOf } from '../delivery.js'

test('一条回复按换行、括号小动作、表情行拆开，最多 6 条', () => {
  assert.deepEqual(splitReply('好啊\n（笑）\n[表情:哼]'), ['好啊', '（笑）', '[表情:哼]'])
  assert.deepEqual(splitReply('一\n二\n三\n四\n五\n六\n七'), ['一', '二', '三', '四', '五', '六\n七'])
})

test('没有的表情不发；有的表情单独成条', () => {
  assert.deepEqual(partOf('你好', () => false), { text: '你好' })
  assert.deepEqual(partOf('[表情:哼]', () => true), { text: '[哼]', sticker: '哼' })
  assert.equal(partOf('[表情:没有]', () => false), undefined)
})

test('两条之间的间隔随字数变长，但封顶 4 秒', () => {
  const a = gapBefore('短', () => 0)
  const b = gapBefore('很长很长很长很长很长很长很长很长很长很长', () => 0)
  assert.ok(a < b)
  assert.ok(b <= 4000)
})

test('打错字只会改一个常见错字，并给一条更正', () => {
  assert.equal(typoOf('短', () => 0), undefined)
  assert.equal(typoOf('（笑）', () => 0), undefined)
  const [wrong, fix] = typoOf('我真的知道', () => 0)
  assert.notEqual(wrong, '我真的知道')
  assert.equal(fix, '*的')
})

test('她说几句，发送层按顺序一条条交出去', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-delivery-'))
  try {
    const sent = []
    const delivery = createDelivery({
      home,
      deliver: (part) => sent.push(part.text),
      toHer: () => {},
      hasSticker: () => false,
      sleep: async () => {},
      random: () => 0.9,
      now: () => 0,
    })
    delivery.out({ seq: 7, time: 1, side: 'her', text: '第一句\n第二句' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(sent, ['第一句', '第二句'])
    assert.equal(delivery.sending(), false)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
