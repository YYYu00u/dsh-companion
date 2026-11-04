import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanTranscript, makeWav, parseWav } from '../wav.js'

test('parseWav 读得懂 16k 单声道', () => {
  const wav = parseWav(makeWav({ seconds: 2, sampleRate: 16000 }))
  assert.equal(wav.sampleRate, 16000)
  assert.equal(wav.channels, 1)
  assert.equal(wav.bitsPerSample, 16)
  assert.ok(Math.abs(wav.seconds - 2) < 0.01)
})

test('parseWav 拒绝非 WAV', () => {
  assert.throws(() => parseWav(Buffer.from('not a wav')), /too short|RIFF/)
})

test('cleanTranscript 去掉 whisper 的占位', () => {
  assert.equal(cleanTranscript(' [BLANK_AUDIO] '), '')
  assert.equal(cleanTranscript('[MUSIC] 你好'), '你好')
  assert.equal(cleanTranscript('(music) 今天好累'), '今天好累')
})
