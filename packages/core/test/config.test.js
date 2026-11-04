import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_NAME, ensureHome, expandPath, resolveHome, resolveNotebook } from '../config.js'

test('expandPath 支持 ~ 和相对路径', () => {
  assert.equal(expandPath('~/x', '/tmp'), join(process.env.HOME, 'x'))
  assert.equal(expandPath('rel/x', '/tmp'), '/tmp/rel/x')
  assert.equal(expandPath('/abs/x', '/tmp'), '/abs/x')
  assert.equal(expandPath('', '/tmp'), undefined)
})

test('没配 home 时默认落在 ~/.dsh-companion', () => {
  assert.equal(resolveHome({}), join(process.env.HOME, '.dsh-companion'))
  assert.equal(resolveHome({ home: '~/mine' }), join(process.env.HOME, 'mine'))
  assert.equal(resolveHome({ notebook: '/data/me/notebook.md' }), '/data/me')
})

test('resolveNotebook 默认是家里的 notebook.md，相对路径也按家算', () => {
  assert.equal(resolveNotebook({}, '/data/me'), '/data/me/notebook.md')
  assert.equal(resolveNotebook({ notebook: '/x/n.md' }, '/data/me'), '/x/n.md')
  assert.equal(resolveNotebook({ notebook: 'notes/n.md' }, '/data/me'), '/data/me/notes/n.md')
})

test('ensureHome 只种一次，已有内容不覆盖', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-home-'))
  try {
    ensureHome(home, { name: '测试鱼' })
    for (const file of ['persona.md', 'notebook.md', 'standard.md', 'self.md', 'owner.md', 'experiences.md', 'moments.md', 'lessons.json', 'body/eyes/PART.md', 'body/wishlist.md', 'skills/README.md', '.gitignore']) {
      assert.ok(existsSync(join(home, file)), `${file} 应该被种出来`)
    }
    assert.match(readFileSync(join(home, 'persona.md'), 'utf8'), /测试鱼/)
    writeFileSync(join(home, 'persona.md'), '# 我自己写的')
    ensureHome(home, { name: '测试鱼' })
    assert.equal(readFileSync(join(home, 'persona.md'), 'utf8'), '# 我自己写的')
    assert.equal(DEFAULT_NAME, '小鲤')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
