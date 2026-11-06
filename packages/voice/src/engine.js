// 本地合成引擎：把 runtime/tts-server.py 拉起来，转发合成请求。
// 起不来只抛错——调用方（网页）把语音整个降级掉，聊天照旧。
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PKG, readVoices } from './voices.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 找 python：环境变量 > 包里的 .venv > 系统 python3 */
function pythonPath() {
  if (process.env.COMPANION_VOICE_PYTHON) return process.env.COMPANION_VOICE_PYTHON
  const venv = join(PKG, '.venv', 'bin', 'python')
  return existsSync(venv) ? venv : 'python3'
}

export function createVoiceEngine({ log = console, port = 4321, modelDir = '', steps = 8 } = {}) {
  const url = `http://127.0.0.1:${port}`
  const script = join(PKG, 'runtime', 'tts-server.py')
  let child
  let ready = false

  async function healthy(timeoutMs = 800) {
    try {
      return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeoutMs) })).ok
    } catch {
      return false
    }
  }

  async function start() {
    if (await healthy()) { ready = true; return }
    const args = [script, '--port', String(port), '--steps', String(steps)]
    if (modelDir) args.push('--model', modelDir)
    child = spawn(pythonPath(), args, { cwd: PKG, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d) => log.info?.(String(d).trimEnd()))
    child.stderr.on('data', (d) => log.warn?.(String(d).trimEnd()))
    child.on('exit', (code) => { ready = false; log.warn?.(`voice: 合成服务退出（${code}）`) })
    for (let i = 0; i < 60 && !ready; i++) {
      if (await healthy()) { ready = true; return }
      await sleep(500)
    }
    throw new Error('本地合成 30 秒没起来：先跑 npm run models 和 npm run refs')
  }

  function stop() {
    if (child && !child.killed) child.kill('SIGTERM')
    child = undefined
    ready = false
  }

  async function say(text, voice, options = {}) {
    const id = voice || readVoices().voices[0]?.id
    if (!id) throw new Error('还没有音色')
    const r = await fetch(`${url}/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice: id, ...(options.steps ? { steps: options.steps } : {}) }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!r.ok) throw new Error(`合成失败：${await r.text().catch(() => r.status)}`)
    return Buffer.from(await r.arrayBuffer())
  }

  return { start, stop, say, get ready() { return ready } }
}
