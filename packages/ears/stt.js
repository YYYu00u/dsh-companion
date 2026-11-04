// Speech-to-text providers. Local whisper.cpp is the default; AssemblyAI is an
// optional cloud fallback. Nothing here downloads models or runs on its own.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { cleanTranscript } from './wav.js'

const run = promisify(execFile)

/** Build whisper.cpp CLI args; exported so the shape is testable without a model. */
export function whisperArgs({ file, model, language = 'zh', outBase }) {
  if (!file) throw new Error('whisper: file is required')
  if (!model) throw new Error('whisper: model is required (for example ggml-small.bin)')
  if (!outBase) throw new Error('whisper: outBase is required')
  return ['-m', model, '-f', file, '-l', language, '-otxt', '-of', outBase, '-np']
}

export async function transcribeLocal({ file, binary = 'whisper-cli', model, language = 'zh', timeoutMs = 120_000 }) {
  const outBase = file.replace(/\.[^.]+$/, '') + '.whisper'
  const args = whisperArgs({ file, model, language, outBase })
  try {
    await run(binary, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 })
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`找不到 ${binary}；先装 whisper.cpp，或把 stt.binary 指到 whisper-cli`)
    throw new Error(`whisper 失败：${String(error.stderr ?? error.message).slice(0, 300)}`)
  }
  const text = await readFile(`${outBase}.txt`, 'utf8').catch(() => '')
  return cleanTranscript(text)
}

/** AssemblyAI: upload + create transcript + poll. Optional; needs an API key. */
export async function transcribeAssemblyAI({ file, apiKey, language = 'zh', timeoutMs = 120_000 }) {
  if (!apiKey) throw new Error('AssemblyAI 需要 apiKey，或者把 stt.provider 换回 local')
  const audio = await readFile(file)
  const upload = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
    body: audio,
  })
  if (!upload.ok) throw new Error(`AssemblyAI 上传失败：HTTP ${upload.status}`)
  const { upload_url: url } = await upload.json()
  const created = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: url, language_code: language === 'zh' ? 'zh' : undefined }),
  })
  if (!created.ok) throw new Error(`AssemblyAI 创建转写失败：HTTP ${created.status}`)
  const { id } = await created.json()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const r = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers: { authorization: apiKey } })
    const data = await r.json()
    if (data.status === 'completed') return cleanTranscript(data.text)
    if (data.status === 'error') throw new Error(`AssemblyAI 转写失败：${data.error ?? 'unknown'}`)
    await new Promise((ok) => setTimeout(ok, 1500))
  }
  throw new Error('AssemblyAI 转写超时')
}

export async function transcribe({ provider = 'local', ...options }) {
  if (provider === 'local') return transcribeLocal(options)
  if (provider === 'assemblyai') return transcribeAssemblyAI(options)
  throw new Error(`不认识的 stt.provider：${provider}`)
}
