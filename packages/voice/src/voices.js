// 音色清单。assets/voices.json 里是「谁来念 + 念的是什么」，参考音频（*.wav）由使用者自己生成：
// 克隆时文字必须和音频对得上，所以 text 字段是清单的一部分，不能随手改。
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
export const ASSET_DIR = join(PKG, 'assets')

let cache

/** { text, voices: [{ id, name, file, duration }] } */
export function readVoices() {
  if (cache) return cache
  try {
    const raw = JSON.parse(readFileSync(join(ASSET_DIR, 'voices.json'), 'utf8'))
    cache = { text: raw.text ?? '', voices: Array.isArray(raw.voices) ? raw.voices : [] }
  } catch {
    cache = { text: '', voices: [] }
  }
  return cache
}

/** 参考音频的绝对路径；id 不合法、文件还没生成都返回 undefined。 */
export function voiceFile(id) {
  if (!/^[a-z0-9_]+$/.test(id ?? '')) return undefined
  const v = readVoices().voices.find((x) => x.id === id)
  if (!v) return undefined
  const full = join(ASSET_DIR, basename(v.file || `${id}.wav`))
  return existsSync(full) ? full : undefined
}
