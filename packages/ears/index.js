// Ears: a push-to-talk listener. It captures 15–30 seconds of system audio,
// microphone, or an audio file, turns it into text, and gives the text to her.
// It never listens on its own and never puts raw audio into the model context.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { capture, cleanup, to16kWav } from './capture.js'
import { transcribe } from './stt.js'
import { parseWav } from './wav.js'
import { expandPath, resolveHome } from '@dsh-companion/core/config'

export const name = 'dsh-companion-ears'
export const inject = ['tools']

const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.mp4', '.mov', '.webm'])
const MAX_URL_BYTES = 50 * 1024 * 1024

function textResult(text) {
  return { text }
}

function format({ text, source, seconds, song }) {
  const where = source === 'mic' ? '麦克风' : source === 'file' ? '音频文件' : '系统声音'
  const head = `你刚才听到（${where}，${seconds} 秒）：`
  const body = [text?.trim() || '没有可转写的人声。']
  if (song?.title) body.push(`[音乐] ${song.title}${song.artist ? ` — ${song.artist}` : ''}`)
  return `${head}\n${body.join('\n')}`
}

export function createEars({ home, config = {}, log }) {
  const stt = config.stt ?? {}
  const binary = stt.binary ?? 'whisper-cli'
  const sttOptions = {
    provider: stt.provider ?? 'local',
    // A bare name stays on PATH; only paths get expanded.
    binary: binary.includes('/') || binary.startsWith('~') ? expandPath(binary) : binary,
    model: expandPath(stt.model),
    language: stt.language ?? 'zh',
    apiKey: stt.apiKey ?? process.env.ASSEMBLYAI_API_KEY,
    timeoutMs: stt.timeoutMs ?? 120_000,
  }
  const maxSeconds = Math.min(30, Math.max(1, Number(config.capture?.maxSeconds ?? 30)))
  const defaultSource = config.capture?.defaultSource === 'mic' ? 'mic' : 'system'

  async function speech(file) {
    if (!sttOptions.model) throw new Error('没有配置 stt.model（whisper 模型路径）')
    return transcribe({ ...sttOptions, file })
  }

  async function listenNow({ seconds = 15, source = defaultSource } = {}) {
    const s = Math.min(maxSeconds, Math.max(1, Number(seconds) || 15))
    const cap = await capture({ helper: expandPath(config.helper), source, seconds: s })
    try {
      const wav = join(cap.dir, '16k.wav')
      await to16kWav(cap.file, wav)
      const text = await speech(wav)
      return { text, source, seconds: Math.round(parseWav(readFileSync(wav)).seconds) || s }
    } finally {
      cleanup(cap.dir)
    }
  }

  async function download(url) {
    let parsed
    try { parsed = new URL(url) } catch { throw new Error('链接格式不对') }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('只支持 http/https 链接')
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`)
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_URL_BYTES) throw new Error('文件太大（50MB 以内）')
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_URL_BYTES) throw new Error('文件太大（50MB 以内）')
    const dir = mkdtempSync(join(tmpdir(), 'dsh-ears-url-'))
    const file = join(dir, basename(parsed.pathname) || 'audio')
    writeFileSync(file, bytes)
    return { file, dir }
  }

  async function listenFile({ path, url } = {}) {
    if (!path && !url) throw new Error('path 或 url 至少给一个')
    let dir
    let file
    if (url) {
      const got = await download(url)
      file = got.file; dir = got.dir
    } else {
      file = expandPath(path)
      if (!file || !existsSync(file)) throw new Error(`找不到文件：${path}`)
      if (!AUDIO_EXT.has(extname(file).toLowerCase())) throw new Error('这个扩展名不像音频/视频')
      dir = mkdtempSync(join(tmpdir(), 'dsh-ears-file-'))
    }
    try {
      const wav = join(dir, '16k.wav')
      await to16kWav(file, wav)
      const text = await speech(wav)
      return { text, source: 'file', seconds: Math.round(parseWav(readFileSync(wav)).seconds) }
    } finally {
      cleanup(dir)
    }
  }

  /** Web side: a voice message / uploaded audio buffer. */
  async function transcribeBuffer(buffer, { mime = 'audio/wav' } = {}) {
    if (!buffer?.length) throw new Error('空音频')
    const dir = mkdtempSync(join(tmpdir(), 'dsh-ears-buf-'))
    try {
      const input = join(dir, 'input')
      const wav = join(dir, '16k.wav')
      writeFileSync(input, buffer)
      await to16kWav(input, wav)
      return await speech(wav)
    } finally {
      cleanup(dir)
    }
  }

  return { listenNow, listenFile, transcribeBuffer }
}

export function apply(ctx, config = {}) {
  const home = resolveHome(config)
  const log = typeof ctx.logger === 'function' ? ctx.logger('dsh-companion-ears') : (ctx.logger ?? console)
  const service = createEars({ home, config, log })
  if (typeof ctx.provide === 'function') ctx.provide('ears', service)

  const reg = (toolName, description, properties, required, run) => ctx.tools.register({
    name: toolName,
    description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) { return textResult(await run(args ?? {})) },
  })

  reg('listen_now',
    '听你现在电脑里正在放的声音，或者你说话。只录一小段（默认 15 秒，最多 30 秒），转成文字后告诉你听到了什么。' +
    '用户说“听听我在放什么/听我说/你听”时用。不要在没有用户明确要求时调用。',
    {
      seconds: { type: 'number', description: '录几秒，1–30，默认 15。' },
      source: { type: 'string', enum: ['system', 'mic'], description: 'system=系统声音，mic=麦克风。默认系统声音。' },
    }, [],
    async ({ seconds, source }) => format(await service.listenNow({ seconds, source })))

  reg('listen_file',
    '听一个本地音频/视频文件，或者一个公开的 http(s) 链接。转成文字后告诉你内容。不要用来下载需要登录或付费的内容。',
    {
      path: { type: 'string', description: '本地文件的绝对路径。' },
      url: { type: 'string', description: '公开的 http(s) 音频/视频链接。' },
      language: { type: 'string', description: '语言代码，默认 zh。' },
    }, [],
    async ({ path, url }) => format(await service.listenFile({ path, url })))

  return service
}
