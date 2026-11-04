import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readVoices, voiceFile } from '../src/voices.js'

test('音色清单：有文本、有音色、id 合法', () => {
  const { text, voices } = readVoices()
  assert.ok(text.length > 40, '参考文本要够长（用来对齐克隆）')
  assert.ok(voices.length >= 5, '至少几个音色')
  for (const v of voices) {
    assert.match(v.id, /^[a-z0-9_]+$/)
    assert.ok(v.name && v.file && v.duration > 0)
  }
})

test('voiceFile：不存在的/非法 id 返回 undefined', () => {
  assert.equal(voiceFile('__nope__'), undefined)
  assert.equal(voiceFile('../../etc/passwd'), undefined)
})
