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

test('sherpaArgs 带模型/tokens/文件，cleanSenseVoice 去标签', async () => {
  const { cleanSenseVoice, sherpaArgs } = await import('../sherpa.js')
  const args = sherpaArgs({ model: '/m/model.int8.onnx', tokens: '/m/tokens.txt', file: '/tmp/a.wav', language: 'zh', threads: 2 })
  assert.ok(args.includes('/m/model.int8.onnx'))
  assert.ok(args.includes('/m/tokens.txt'))
  assert.ok(args.includes('/tmp/a.wav'))
  assert.equal(cleanSenseVoice('<|zh|><|NEUTRAL|><|Speech|><|woitn|>你好，世界'), '你好，世界')
})

test('transcribeSherpa 解析 worker 的 JSON 并清理标签', async () => {
  const { transcribeSherpa } = await import('../sherpa.js')
  const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ears-sherpa-'))
  try {
    const model = join(dir, 'model.int8.onnx'); writeFileSync(model, 'x')
    const tokens = join(dir, 'tokens.txt'); writeFileSync(tokens, 'x')
    const worker = join(dir, 'worker.js')
    writeFileSync(worker, 'process.stdout.write(JSON.stringify({ok:true,text:"<|zh|><|NEUTRAL|>你好"})+"\\n")')
    const text = await transcribeSherpa({ file: join(dir, 'a.wav'), model, tokens, worker, node: process.execPath })
    assert.equal(text, '你好')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
