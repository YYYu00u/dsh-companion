import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixLine, moveToPast, notebookForHer } from '../index.js'

const BOOK = `# 小本子

## 主人给我的设定

- 叫我鱼鱼

## 关于主人

- 2026-01-01 他下周三面试
- 2026-01-02 他不吃香菜

## 我自己的事

- 2026-01-03 今天学会了一个新梗

## 过去的事

- 2026-01-04 旧的面试（过去了）
`

test('过去的事不摆在她面前，但还留在文件里', () => {
  const text = notebookForHer(BOOK)
  assert.match(text, /他不吃香菜/)
  assert.doesNotMatch(text, /旧的面试/)
})

test('本子太厚先丢最早的，主人的设定一条不丢', () => {
  const text = notebookForHer(BOOK, 60)
  assert.match(text, /叫我鱼鱼/)
  assert.doesNotMatch(text, /他下周三面试/)
  assert.match(text, /还没放进来|本子太厚/)
})

test('moveToPast 只挪一条，并且标上过去了', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-companion-book-'))
  try {
    const file = join(dir, 'notebook.md')
    writeFileSync(file, BOOK)
    moveToPast(file, '不吃香菜', '吃过了')
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text.split('## 过去的事')[0], /不吃香菜/)
    assert.match(text.split('## 过去的事')[1], /不吃香菜.*吃过了/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('fixLine 改错不会把原文弄丢', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-companion-fix-'))
  try {
    const file = join(dir, 'notebook.md')
    writeFileSync(file, BOOK)
    fixLine(file, '下周三面试', '他下周三去欢乐谷，没有面试', '他说没有面试')
    const text = readFileSync(file, 'utf8')
    assert.match(text.split('## 过去的事')[0], /去欢乐谷/)
    assert.match(text.split('## 过去的事')[1], /下周三面试.*记错了/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('一处对不上多条时拒绝改，避免误伤', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-companion-fix2-'))
  try {
    const file = join(dir, 'notebook.md')
    writeFileSync(file, BOOK.replace('## 我自己的事', '- 2026-01-05 他不吃香菜也不吃葱\n\n## 我自己的事'))
    assert.throws(() => fixLine(file, '不吃香菜', '改成不吃葱', '测试'), /2 条/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
