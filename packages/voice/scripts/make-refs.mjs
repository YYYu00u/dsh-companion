#!/usr/bin/env node
// 用自己的豆包 key 生成参考音频（不随包分发音频）。
// 用法：VOLC_KEY=xxx node scripts/make-refs.mjs
// 需要 ffmpeg（mp3 -> 24k 单声道 wav）。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
const ASSET = join(PKG, 'assets')
const URL_TTS = 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional'
const KEY = process.env.VOLC_KEY

if (!KEY) { console.error('先设置 VOLC_KEY（豆包语音的 API Key）'); process.exit(1) }
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) } catch { console.error('需要 ffmpeg：brew install ffmpeg'); process.exit(1) }

const { text, voices } = JSON.parse(readFileSync(join(ASSET, 'voices.json'), 'utf8'))

/** 返回一串拼接的 JSON，逐个解出来拼 base64 音频 */
function parseChunks(raw) {
  const dec = new JSONDecoder()
  const out = []
  let i = 0
  while (i < raw.length) {
    while (i < raw.length && /\s/.test(raw[i])) i++
    if (i >= raw.length) break
    const [obj, next] = dec.decode(raw, i)
    i = next
    if (obj?.data) out.push(Buffer.from(obj.data, 'base64'))
  }
  return Buffer.concat(out)
}

class JSONDecoder {
  decode(str, pos) {
    // 用 JSON.parse 二分不靠普，这里用括号配平找边界（音频串里没有裸的 }）
    let depth = 0, inStr = false, esc = false
    for (let i = pos; i < str.length; i++) {
      const c = str[i]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return [JSON.parse(str.slice(pos, i + 1)), i + 1]
      }
    }
    throw new Error('返回的 JSON 没闭合')
  }
}

let done = 0
for (const v of voices) {
  const wav = join(ASSET, v.file)
  if (existsSync(wav)) { console.log(`跳过 ${v.name}（已有 ${v.file}）`); continue }
  process.stdout.write(`${v.name} 生成中… `)
  const r = await fetch(URL_TTS, {
    method: 'POST',
    headers: { 'X-Api-Key': KEY, 'X-Api-Resource-Id': 'seed-tts-2.0', 'content-type': 'application/json' },
    body: JSON.stringify({ user: { uid: '1' }, req_params: { text, speaker: v.id, audio_params: { format: 'mp3', sample_rate: 24000 } } }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!r.ok) { console.error(`失败 ${r.status}：${(await r.text()).slice(0, 200)}`); continue }
  const mp3 = parseChunks(await r.text())
  const tmp = join(ASSET, `${v.id}.mp3`)
  writeFileSync(tmp, mp3)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ar', '24000', '-ac', '1', wav])
  execFileSync('rm', ['-f', tmp])
  console.log(`✓ ${v.file}`)
  done++
}
console.log(`完成 ${done} 个，参考文本：${text.slice(0, 20)}…`)
