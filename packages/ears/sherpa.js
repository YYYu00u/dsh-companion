// Adapter for sherpa-onnx + SenseVoiceSmall. The worker is spawned per call and
// exits after the result, so idle RAM is zero.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))

export function cleanSenseVoice(text) {
  return String(text ?? '')
    .replace(/<\|[^|]+\|>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sherpaArgs({ worker, model, tokens, file, language = 'zh', threads = 2 }) {
  if (!model) throw new Error('sherpa: model 路径是空的')
  if (!tokens) throw new Error('sherpa: tokens.txt 路径是空的')
  if (!file) throw new Error('sherpa: file 是空的')
  return [worker ?? join(HERE, 'sherpa-worker.js'), '--model', model, '--tokens', tokens, '--file', file, '--language', language, '--threads', String(threads)]
}

export async function transcribeSherpa({ file, model, tokens, language = 'zh', threads = 2, worker, node, timeoutMs = 120_000 }) {
  if (!existsSync(model)) throw new Error(`sherpa 模型不存在：${model}`)
  if (!existsSync(tokens)) throw new Error(`sherpa tokens 不存在：${tokens}`)
  const args = sherpaArgs({ worker, model, tokens, file, language, threads })
  const command = node ?? process.execPath
  const env = { ...process.env }
  // DSH runs inside Electron; make the child behave like Node, not another app.
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1'
  let stdout
  try {
    ({ stdout } = await run(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env }))
  } catch (error) {
    if (error.killed || error.signal) throw new Error('sherpa 转写超时')
    throw new Error(`sherpa 失败：${String(error.stderr ?? error.message).slice(0, 500)}`)
  }
  const line = stdout.trim().split('\n').filter(Boolean).pop()
  let parsed
  try { parsed = JSON.parse(line) } catch { throw new Error(`sherpa 没有返回 JSON：${stdout.slice(0, 200)}`) }
  if (!parsed.ok) throw new Error(parsed.error ?? 'sherpa 转写失败')
  return cleanSenseVoice(parsed.text)
}
