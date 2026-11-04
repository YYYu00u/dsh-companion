// Capture is a small Swift helper; this module only spawns it and normalizes the
// result to a 16 kHz mono WAV that whisper.cpp/SenseVoice can eat.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)

export function captureArgs({ source = 'system', seconds = 15, out }) {
  if (!['system', 'mic'].includes(source)) throw new Error('source 只能是 system 或 mic')
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 30) throw new Error('seconds 要在 1–30 之间')
  if (!out) throw new Error('out is required')
  return ['--source', source, '--seconds', String(Math.round(seconds)), '--out', out]
}

export async function capture({ helper, source = 'system', seconds = 15, timeoutMs = 45_000 }) {
  if (!helper) throw new Error('没有配置 ears.helper（Swift 采集程序）')
  if (!existsSync(helper)) throw new Error(`找不到采集程序：${helper}`)
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ears-'))
  const raw = join(dir, 'raw.wav')
  try {
    await run(helper, captureArgs({ source, seconds, out: raw }), { timeout: timeoutMs, maxBuffer: 1024 * 1024 })
    if (!existsSync(raw)) throw new Error('采集程序没有生成 wav')
    return { file: raw, dir }
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    if (error.code === 'ETIMEDOUT') throw new Error('采集超时')
    throw new Error(`采集失败：${String(error.stderr ?? error.message).slice(0, 300)}`)
  }
}

/** Normalize any audio file to 16 kHz mono PCM WAV. */
export async function to16kWav(input, out) {
  try {
    await run('ffmpeg', ['-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out], { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 })
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('找不到 ffmpeg；先 brew install ffmpeg')
    throw new Error(`ffmpeg 转换失败：${String(error.stderr ?? error.message).slice(0, 300)}`)
  }
  return out
}

export function cleanup(dir) {
  if (dir) rmSync(dir, { recursive: true, force: true })
}
