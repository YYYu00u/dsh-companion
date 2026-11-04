// 手的 preset（dsh-companion-hands）里挂的那一行：人设 + 技能 + 心愿单。
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { applyHands } from './hands.js'
import { companionConfig, ensureHome, resolveHome } from './config.js'

export const name = 'dsh-companion-hands'
export const inject = ['systemPrompt', 'tools']

export function apply(ctx, config = {}) {
  const home = resolveHome(config)
  const { name: who } = companionConfig(config)
  ensureHome(home, { name: who })
  let queue = Promise.resolve()
  const commit = (file, message) => {
    if (!existsSync(join(home, '.git'))) return
    const git = (args) => new Promise((resolve) => execFile('git', ['-C', home, ...args], () => resolve()))
    const rel = relative(home, file)
    queue = queue.then(() => git(['add', '--', rel])).then(() => git(['-c', `user.name=${who}`, '-c', 'user.email=persona@local', 'commit', '-q', '-m', message, '--', rel]))
  }
  applyHands(ctx, home, commit, who)
}
