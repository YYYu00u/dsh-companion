import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DICT, LEVELS_EN, detectLang, localizeError, setLang, t } from '../public/i18n.js'

const keys = (lang) => Object.keys(DICT[lang]).sort()

test('中英文字典的 key 完全一致', () => {
  assert.deepEqual(keys('en'), keys('zh'))
  assert.ok(keys('zh').length > 80)
})

test('HTML 里每个 data-i18n key 两边都有', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
  const attrs = [...html.matchAll(/data-i18n(?:-title|-aria|-placeholder|-alt)?="([^"]+)"/g)].map((m) => m[1])
  assert.ok(attrs.length > 25)
  for (const key of new Set(attrs)) {
    assert.ok(key in DICT.zh, `zh 缺 ${key}`)
    assert.ok(key in DICT.en, `en 缺 ${key}`)
  }
})

test('app.js 里静态 t() 的 key 都存在', () => {
  const js = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8')
  const used = [...js.matchAll(/\bt\('([^']+)'/g)].map((m) => m[1])
  for (const key of new Set(used)) {
    assert.ok(key in DICT.zh, `zh 缺 ${key}`)
    assert.ok(key in DICT.en, `en 缺 ${key}`)
  }
})

test('插值和单复数占位不会漏', () => {
  setLang('zh')
  assert.equal(t('time.daysAgo', { n: 3 }), '3 天前')
  assert.match(t('error.send', { msg: 'x' }), /x/)
  setLang('en')
  assert.equal(t('time.daysAgo', { n: 3 }), '3 days ago')
  assert.match(t('mood.title', { score: 70, base: ', base 60' }), /70 \/ 100/)
})

test('语言检测：URL 优先，其次浏览器', () => {
  assert.equal(detectLang('?lang=en', 'zh-CN'), 'en')
  assert.equal(detectLang('?lang=zh', 'en-US'), 'zh')
  assert.equal(detectLang('', 'zh-CN'), 'zh')
  assert.equal(detectLang('', 'en-US'), 'en')
})

test('服务端中文错误能翻成英文', () => {
  setLang('en')
  assert.equal(localizeError('消息是空的'), 'Message is empty')
  assert.equal(localizeError('unknown thing'), 'unknown thing')
  setLang('zh')
})

test('英文档位文案和中文档位数一样', () => {
  assert.equal(LEVELS_EN.length, 5)
  for (const level of LEVELS_EN) assert.ok(level.name && level.desc)
})
