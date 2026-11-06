import assert from 'node:assert/strict'
import { test } from 'node:test'
import { load, status, validate } from '../scripts/extensions.mjs'

test('extensions.json：格式对、路径在、包名对得上', () => {
  const problems = validate(load())
  assert.deepEqual(problems, [], problems.join('\n'))
})

test('扩展：基础不在清单里，每个都有用途说明', () => {
  const { extensions } = load()
  const ids = extensions.map((e) => e.id)
  assert.ok(!ids.includes('core') && !ids.includes('web'), 'core/web 是基础，不该算扩展')
  for (const e of extensions) assert.ok(e.summary.length > 8, `${e.id} 的说明太短`)
})

test('状态查询：能报出模型在不在，不会抛', () => {
  const rows = status(load())
  assert.equal(rows.length, load().extensions.length)
  const voice = rows.find((r) => r.id === 'voice')
  assert.ok(voice && voice.models.length === 2)
})
