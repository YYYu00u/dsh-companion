// 必应网页搜索提供方：注册到 ctx.web，web_search 工具会自动用它。
// 不需要 API key：直接请求 cn.bing.com 结果页，从 HTML 里取标题、链接、摘要。
// 页面结构变了只会解析不出结果（明确报错），不会编造内容。

export const name = 'dsh-web-search-bing'
export const inject = ['web']

const ID = 'bing'
const ENDPOINT = 'https://cn.bing.com/search'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
const TIMEOUT_MS = 15000

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ' }

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

function text(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

// 必应把真实地址包在 /ck/a?...&u=a1<base64url> 里，拆出来。
function realUrl(href) {
  try {
    const u = new URL(href, 'https://cn.bing.com')
    const wrapped = u.pathname === '/ck/a' ? u.searchParams.get('u') : null
    if (wrapped && wrapped.startsWith('a1')) {
      const b64 = wrapped.slice(2).replace(/-/g, '+').replace(/_/g, '/')
      const decoded = Buffer.from(b64, 'base64').toString('utf8')
      if (/^https?:\/\//.test(decoded)) return decoded
    }
    return u.href
  } catch {
    return undefined
  }
}

export function parseResults(html) {
  const out = []
  const seen = new Set()
  for (const block of html.split('<li class="b_algo"').slice(1)) {
    const a = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!a) continue
    const url = realUrl(decodeEntities(a[1]))
    if (!url || seen.has(url)) continue
    seen.add(url)
    const p = block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    const source = { url, title: text(a[2]) }
    if (p) {
      const snippet = text(p[1])
      if (snippet) source.snippet = snippet
    }
    out.push(source)
  }
  return out
}

function webError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

class BingSearchProvider {
  id = ID

  available() {
    return true
  }

  async search(request, signal) {
    const query = String(request.query ?? '').trim()
    if (!query) throw webError('WEB_PROVIDER_ERROR', 'Bing search: empty query')
    // 不加 ensearch=1：实测它会让英文查询返回无关结果。
    const params = new URLSearchParams({ q: query })
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    let res
    try {
      res = await fetch(`${ENDPOINT}?${params}`, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
        signal: combined,
      })
    } catch (e) {
      if (signal?.aborted) throw webError('WEB_ABORTED', 'Bing search aborted')
      throw webError('WEB_PROVIDER_ERROR', `Bing search request failed: ${e?.message ?? e}`)
    }
    if (!res.ok) throw webError('WEB_PROVIDER_ERROR', `Bing search HTTP ${res.status}`)
    const sources = parseResults(await res.text())
    if (sources.length === 0) {
      throw webError('WEB_PROVIDER_ERROR', 'Bing search returned no parsable results (no matches, or the result page layout changed)')
    }
    return { sources, truncated: false }
  }
}

export function apply(ctx) {
  // registerSearchProvider 返回的注销函数随本插件 fiber 释放。
  ctx.web.registerSearchProvider(new BingSearchProvider())
}
