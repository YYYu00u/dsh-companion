import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureArgs } from '../capture.js'
import { transcribeLocal, whisperArgs } from '../stt.js'

test('whisperArgs 带模型、语言和输出前缀', () => {
  const args = whisperArgs({ file: '/tmp/a.wav', model: '/m/ggml-small.bin', language: 'zh', outBase: '/tmp/a.whisper' })
  assert.deepEqual(args.slice(0, 6), ['-m', '/m/ggml-small.bin', '-f', '/tmp/a.wav', '-l', 'zh'])
  assert.ok(args.includes('-otxt'))
  assert.ok(args.includes('/tmp/a.whisper'))
})

test('captureArgs 限制 1–30 秒', () => {
  assert.deepEqual(captureArgs({ source: 'system', seconds: 15, out: '/tmp/x.wav' }), ['--source', 'system', '--seconds', '15', '--out', '/tmp/x.wav'])
  assert.throws(() => captureArgs({ source: 'system', seconds: 60, out: '/tmp/x.wav' }), /1–30/)
  assert.throws(() => captureArgs({ source: 'screen', seconds: 15, out: '/tmp/x.wav' }), /system/)
})

test('transcribeLocal 会把 -of 交给 whisper-cli 并读回 txt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ears-stt-'))
  try {
    const fake = join(dir, 'whisper-cli')
    writeFileSync(fake, '#!/bin/sh\nout=""\nwhile [ $# -gt 0 ]; do\n  if [ "$1" = "-of" ]; then out="$2"; shift 2; else shift; fi\ndone\nprintf "你好，测试" > "$out.txt"\n')
    chmodSync(fake, 0o755)
    const wav = join(dir, 'a.wav')
    writeFileSync(wav, 'x')
    const text = await transcribeLocal({ file: wav, binary: fake, model: '/m.bin', language: 'zh' })
    assert.equal(text, '你好，测试')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
