// 插件入口：起停本地合成服务。没装模型/没生成参考音频时只记日志，不影响别的插件。
import { createVoiceEngine } from './src/engine.js'
import { readVoices } from './src/voices.js'

export const name = 'companion-voice'
export const inject = []

export function apply(ctx, config = {}) {
  const log = typeof ctx.logger === 'function' ? ctx.logger('companion-voice') : (ctx.logger ?? console)
  const { voices } = readVoices()
  if (!voices.length) { log.warn?.('voice: assets/voices.json 是空的，语音关着'); return }
  log.info?.(`voice: ${voices.length} 个音色`)

  const engine = createVoiceEngine({ log, port: config.port ?? 4321, modelDir: config.modelDir ?? '', steps: config.steps ?? 8 })
  ctx.effect(() => {
    engine.start().catch((e) => log.warn?.(`voice: ${e.message}`))
    return () => engine.stop()
  })
}
