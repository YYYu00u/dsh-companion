// 记忆在压缩这一侧做的事：继承 DSH 自带的压缩（什么时候压、压哪段、替换的事务和锁、模型报「太长」后的恢复都用它的），
// 只换 summarize()：被压掉的原话按 30 分钟切成几阵，一次调用写成经历（中期记忆），压缩留下的就是这几段的经过。
// 一直没压满就按天压：每轮开始前看一眼，聊天历史里还有「昨天」（凌晨 4 点分界）的原话，就先把昨天那部分压掉。
// 另外把已经结束的回合里她的思考从请求里拿掉（思考不进请求）。
import { hostImport } from './hostdeps.js'
import { consolidate, redescribe } from './episodes.js'
import { boutText, dayOf, episodeLine, GAP_MS, openMemory, splitIntoBouts } from './store.js'
import { turnOf } from './chat.js'
import { expandPath } from '../config.js'

const { BasicCompactionEngine } = await hostImport('dsh-compaction-basic')
const { toolPairingBalancedAfter, toolPairingBalancedBefore } = await hostImport('dsh-compaction')
const { isAgentLoopRequest, markAgentLoopRequest } = await hostImport('dsh-llm')

const HEADER = '下面是今天之前、或者今天早些时候你们聊过的，原话已经不在眼前了，只记得个大概。接着现在的聊天自然地说，别提「记录」「摘要」。'

export default class CompanionCompaction extends BasicCompactionEngine {
  static inject = BasicCompactionEngine.inject
  // 我们自己的几项配置先拿出来，剩下的交给 DSH 的压缩校验（它不认识的键会报错）。
  constructor(ctx, config = {}) {
    const { home, preset, name: who, episodeProvider, episodeModel, daily, stripReasoning, thresholdTokens = 24000, retainTokens = 6000, ...basic } = config
    super(ctx, { ...basic, retainTokens })
    // 短期记忆装多少：固定的 token 数，不按模型窗口的比例（100 万窗口的 15% 是 15 万，太大）。
    this.thresholdTokens = thresholdTokens
    const resolved = expandPath(home)
    if (!resolved) throw new Error('dsh-companion-compact: config.home 必须是她的家（~/.dsh-companion）')
    this.home = resolved
    // llm/stream 是全局的，别的 preset 的请求也会经过这里：只动 agentPreset 是自己的会话
    this.presetId = preset
    this.who = who ?? '大肥鱼'
    this.episodeTarget = episodeProvider && episodeModel ? { provider: episodeProvider, model: episodeModel } : undefined
    this.mem = openMemory(this.home)
    if (daily !== false) this._registerDaily(ctx)
    if (stripReasoning !== false && preset) this._registerStripReasoning(ctx)
  }

  /** 压之前把这个模型的压缩线换算成固定 token 数：DSH 的压缩只认比例，这里按窗口算出比例塞进去。 */
  async compactIfNeeded(agent, trigger, signal) {
    const t = routed(agent.session)
    if (t && !this.config.modelPolicies.some((x) => x.provider === t.provider && x.model === t.model)) {
      try {
        const info = await this.ctx.llm.resolveModelInfo(t.provider, t.model, signal)
        const w = info.context?.contextWindow
        if (w > 0) this.config = { ...this.config, modelPolicies: [...this.config.modelPolicies, { provider: t.provider, model: t.model, thresholdRatio: Math.min(0.8, this.thresholdTokens / w) }] }
      } catch {}
    }
    return super.compactIfNeeded(agent, trigger, signal)
  }

  /** 被压掉的这段 → 几阵原话 → 经历。返回经历的经过，替换掉原话。 */
  async summarize(input, agent, signal) {
    const session = agent.session
    const shadowed = new Set(input.messages.map((m) => m.id).filter(Boolean))
    // 被压掉的原话：档案是边聊边记的，这里再补一遍以防万一
    for (const e of session.snapshotEvents()) {
      const t = turnOf(e, session.id)
      if (t && shadowed.has(t.msgId)) this.mem.addTurn(t)
    }
    const covered = this.mem.coveredTurnIds()
    const turns = this.mem.turns.filter((t) => shadowed.has(t.msgId))
    // 要写成经历的：被压掉的这些，加上更早还没写过的（第一次用时补历史：以前被 DSH 自带压缩压掉的那些原话）
    const upTo = Math.max(0, ...turns.map((t) => t.at))
    const bouts = splitIntoBouts(this.mem.turns.filter((t) => !covered.has(t.id) && (shadowed.has(t.msgId) || t.at <= upTo)))
    const target = this.episodeTarget ?? routed(session) ?? routedFromAgent(agent)
    const log = typeof this.ctx.logger === 'function' ? this.ctx.logger('dsh-companion-compact') : console
    const written = await consolidate(this.mem, bouts, { llm: this.ctx.llm, provider: target?.provider, model: target?.model, name: this.who, signal, log })
    // 以前写失败的粗经历，顺手修几段
    try { await redescribe(this.mem, { llm: this.ctx.llm, provider: target?.provider, model: target?.model, name: this.who, signal, log }, 3) } catch (e) { if (signal?.aborted) throw e }
    // 这次压缩覆盖到的经历：被压掉的原话所在的段 + 被压掉的旧检查点里列着的段
    const ids = new Set(turns.map((t) => t.id))
    const keep = new Set(input.messages.flatMap((m) => this.mem.checkpointIds(m)))
    for (const e of this.mem.episodes()) if ((e.turnIds ?? []).some((id) => ids.has(id))) keep.add(e.id)
    const now = Date.now()
    const eps = this.mem.episodes().filter((e) => keep.has(e.id))
    // 太老的（超过 3 天）不带：要用时靠「想起来」
    const shown = eps.filter((e) => now - e.to < 3 * 86400_000).slice(-12)
    const text = `${HEADER}\n${shown.length ? shown.map((e) => episodeLine(e, { now })).join('\n') : '（没什么要紧的。）'}`
    this.mem.rememberCheckpoint(text, shown.map((e) => e.id))
    return {
      summary: [{ type: 'text', text }],
      rawOutput: [{ type: 'text', text: JSON.stringify({ wrote: written.map((e) => e.id), shown: shown.map((e) => e.id), bouts: bouts.length }) }],
      provider: target?.provider ?? 'local',
      model: target?.model ?? 'episodes',
    }
  }

  /**
   * 按天压：每一步开始前（在 DSH 自己的压力检查之后），聊天历史里还有昨天及以前的原话，
   * 而且最近一句已经过去 30 分钟（不是正聊着），就把昨天及以前那部分压掉。
   */
  _registerDaily(ctx) {
    // 一个会话一天只试一次：昨天那部分太短（压了反而更长）或者失败了，就别每一步都试。
    const tried = new WeakMap()
    ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
      try {
        const today = dayOf(Date.now())
        if (!signal?.aborted && tried.get(agent.session) !== today) {
          const range = this._yesterdayRange(agent.session)
          if (range) {
            tried.set(agent.session, today)
            await this.compactRegion(range.start, range.end, agent, signal)
          }
        }
      } catch (error) {
        ctx.logger?.('dsh-companion-compact')?.warn?.(`按天压缩没成：${error?.message ?? error}`)
      }
      return next()
    })
  }

  _yesterdayRange(session) {
    const nodes = session.surface.nodes
    if (nodes.length < 4) return null
    const today = dayOf(Date.now())
    const firstIdx = session.eventAt(nodes[0])?.type === 'system/message' ? 1 : 0
    let endIdx = -1
    let lastTalk = 0
    for (let i = firstIdx; i < nodes.length; i++) {
      const e = session.eventAt(nodes[i])
      if (!e) continue
      if (e.type === 'user/message' || e.type === 'assistant/message') lastTalk = Math.max(lastTalk, e.time ?? 0)
      if (dayOf(e.time ?? Date.now()) < today) endIdx = i
    }
    if (endIdx < firstIdx) return null
    // 昨天那部分只剩上一次的检查点、没有原话，就不用压
    const hasTalk = nodes.slice(firstIdx, endIdx + 1).some((s) => { const e = session.eventAt(s); return turnOf(e, session.id) })
    if (!hasTalk) return null
    // 昨天聊到一半跨过 4 点、到现在还没停：等停下来再压
    if (dayOf(lastTalk) < today && Date.now() - lastTalk < GAP_MS) return null
    // 切点要落在工具调用配对完整的地方
    while (endIdx >= firstIdx && !toolPairingBalancedAfter(session, nodes[endIdx])) endIdx--
    if (endIdx < firstIdx || !toolPairingBalancedBefore(session, nodes[firstIdx])) return null
    // 太短的不压：压完的检查点比原文还长，DSH 会拒绝
    let size = 0
    for (const seq of nodes.slice(firstIdx, endIdx + 1)) size += JSON.stringify(session.eventAt(seq)?.data ?? '').length
    if (size < 3000) return null
    return { start: nodes[firstIdx], end: nodes[endIdx] }
  }

  /**
   * 思考不进请求：她已经结束的回合里，assistant 消息里的思考块拿掉。
   * 只动这个 preset 自己会话的请求；正在进行的这一轮（还在调工具）保留，DeepSeek 要求一次工具调用里的思考连着。
   */
  _registerStripReasoning(ctx) {
    // waterfall 的 next() 不收参数（最里层用的还是原来的请求），没法把改过的请求往下传；
    // 所以改过的请求重新走一遍 ctx.llm.stream()，自己这一层在第二遍里放行（mine 记着），原来那条链不再往下走。
    // 挂在最前面（prepend），别的监听器只在第二遍跑一次；agent loop 的标记跟着带过去。
    const mine = new WeakSet()
    ctx.on('llm/stream', (options, next) => {
      if (mine.has(options) || !options?.sessionId || !Array.isArray(options.messages)) return next()
      const session = ctx.sessions?.get?.(options.sessionId)
      if (!session || !this._mine(session)) return next()
      const messages = stripFinishedReasoning(options.messages)
      if (messages === options.messages) return next()
      const replaced = { ...options, messages }
      mine.add(replaced)
      if (isAgentLoopRequest(options)) markAgentLoopRequest(replaced)
      return ctx.llm.stream(replaced)
    }, { global: true, prepend: true })
  }

  _mine(session) {
    return session.header?.agentPreset === this.presetId
  }
}

function routed(session) {
  const c = session.requestHeader?.()?.config
  return c?.provider && c?.model ? { provider: c.provider, model: c.model } : undefined
}
function routedFromAgent(agent) {
  const o = agent.options ?? {}
  return o.provider && o.model ? { provider: o.provider, model: o.model } : undefined
}

/**
 * 已经结束的回合里，assistant 消息的思考块拿掉。最后一条用户消息（他说的、旁白、背景）以后的是正在进行的这一轮，保留。
 * 没有可拿的就原样返回同一个数组。
 */
export function stripFinishedReasoning(msgs) {
  // 这一轮从他（或旁白）那条消息开始；每步追加的背景快照（runtime-context）不算轮的开头
  let cut = -1
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user' && msgs[i].source?.kind !== 'runtime-context' && msgs[i].source?.kind !== 'compact-checkpoint') { cut = i; break }
  if (cut <= 0) return msgs
  let changed = false
  const out = msgs.map((m, i) => {
    if (i >= cut || m.role !== 'assistant' || !m.content?.some((b) => b.type === 'reasoning')) return m
    changed = true
    // replayState 按块对齐，块数变了会被判成坏的；去掉以后按普通历史发
    const { replayState, ...source } = m.source ?? {}
    return { ...m, content: m.content.filter((b) => b.type !== 'reasoning'), source }
  })
  return changed ? out : msgs
}
