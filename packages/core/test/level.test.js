import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_LEVEL, LEVELS, levelOf, readLevel, writeLevel } from '../level.js'

test('档位默认第 2 档，写进去能读出来', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-level-'))
  try {
    assert.equal(readLevel(home), DEFAULT_LEVEL)
    writeLevel(home, 4)
    assert.equal(readLevel(home), 4)
    assert.equal(levelOf(home).ownPerDay, LEVELS[4].ownPerDay)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('越界的档位拒绝写入', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-companion-level2-'))
  try {
    assert.throws(() => writeLevel(home, 5), /0 到 4/)
    assert.throws(() => writeLevel(home, -1), /0 到 4/)
    assert.throws(() => writeLevel(home, 1.5), /0 到 4/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
