import { applyStatic, detectLang, feelingLabel, getLang, LEVELS_EN, localizeError, setLang, t } from './i18n.js'

const $ = (id) => document.getElementById(id)
const LANG_KEY = 'dsh-companion-lang'

// 语言：?lang= > 上次选的 > 浏览器。切换只换界面，她说过的话、日记、记忆原文不动。
const langParams = new URLSearchParams(location.search)
let savedLang
try { savedLang = localStorage.getItem(LANG_KEY) } catch {}
const initialLang = ['zh', 'en'].includes(langParams.get('lang'))
  ? langParams.get('lang')
  : ['zh', 'en'].includes(savedLang) ? savedLang : detectLang('', navigator.language)
setLang(initialLang)
if (langParams.has('lang')) { try { localStorage.setItem(LANG_KEY, initialLang) } catch {} }
applyStatic()

// 这一页是谁：主人格有立绘，人格库里的人还没有样子，用名字的第一个字当头像。
let who = { name: '小鲤', main: true, modules: ['remind', 'reflect', 'own', 'nudge'] }
const whoReady = fetch('api/who').then((r) => r.json()).then((w) => { if (w && w.name) who = w }).catch(() => {}).then(() => {
  document.title = who.name
  document.querySelector('.who h1').textContent = who.name
  document.body.classList.toggle('plain', !who.main)
  document.body.style.setProperty('--initial', JSON.stringify([...who.name][0]))
  if (!who.main) {
    $('figure').alt = t('plain.alt', { name: who.name })
    $('avatar').removeAttribute('src')
  }
})
const list = $('list')
const statusEl = $('status')
const seen = new Set()
let lastTime = 0
let lastSide = ''

const pad = (n) => String(n).padStart(2, '0')
const locale = () => (getLang() === 'zh' ? 'zh-CN' : 'en-US')
const dateText = (d) => new Intl.DateTimeFormat(locale(), { month: 'long', day: 'numeric' }).format(d)
const listSep = () => (getLang() === 'zh' ? '，' : ', ')
function when(ts) {
  const d = new Date(ts)
  const now = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return hm
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `${t('time.yesterday')} ${hm}`
  return `${dateText(d)} ${hm}`
}

function setStatus(text, typing = false) {
  statusEl.textContent = text
  statusEl.classList.toggle('typing', typing)
}

// 拆条和发送节奏都在后端（delivery.js）做好了：一行就是一条，到了就显示。

function bubble(side, text, lead, fresh, img) {
  const row = document.createElement('div')
  row.className = `row ${side}${lead ? ' lead' : ''}${fresh ? ' fresh' : ''}`
  const b = document.createElement('div')
  if (img) {
    // 表情包 / 他发的图：显示成图，名字放在 alt 里；点一下在新标签打开原图。
    b.className = 'bubble pic'
    const a = document.createElement('a')
    a.href = img.src; a.target = '_blank'; a.rel = 'noopener'; a.title = t('image.open', { alt: img.alt })
    const im = document.createElement('img')
    im.src = img.src; im.alt = img.alt; im.loading = 'lazy'; im.width = 160; im.height = 160
    im.addEventListener('load', scrollDown, { once: true })
    a.appendChild(im)
    b.appendChild(a)
    if (text) { const c = document.createElement('div'); c.className = 'bubble cap'; c.textContent = text; b.appendChild(c) }
  } else {
    b.className = side === 'her' && /^[（(].*[）)]$/.test(text) ? 'bubble aside' : 'bubble'
    b.textContent = text
  }
  row.appendChild(b)
  list.appendChild(row)
}

function scrollDown() { list.scrollTop = list.scrollHeight }


function add(row, live) {
  if (seen.has(row.seq)) return
  seen.add(row.seq)
  $('empty')?.remove()
  if (row.time - lastTime > 5 * 60_000) {
    const g = document.createElement('div')
    g.className = 'gap'
    g.textContent = when(row.time)
    list.appendChild(g)
    lastSide = ''
  }
  lastTime = row.time
  const img = row.sticker ? { src: `api/sticker/${encodeURIComponent(row.sticker)}`, alt: row.sticker }
    : row.pic ? { src: `api/pic/${row.pic}`, alt: t('image.alt') } : undefined
  bubble(row.side, row.sticker ? '' : row.text, row.side === 'her' && lastSide !== 'her', live, img)
  lastSide = row.side
  scrollDown()
}

let busy = false
function resetHistory() {
  list.replaceChildren()
  seen.clear()
  lastTime = 0
  lastSide = ''
}
async function loadHistory() {
  const r = await fetch('api/history').then((r) => r.json())
  if (r.error) return showError(t('error.history', { error: localizeError(r.error) }))
  if (!r.rows.length) list.innerHTML = `<div id="empty" class="empty">${t('empty.chat')}</div>`
  r.rows.forEach((row) => add(row, false))
  busy = r.busy
  setStatus(busy ? t('status.typing') : '', busy)
}

function listen() {
  const es = new EventSource('api/events')
  es.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'row') add(m.row, true)
    if (m.type === 'typing') { busy = true; setStatus(t('status.typing'), true); $('tank').classList.add('typing') }
    if (m.type === 'idle') {
      busy = false
      $('tank').classList.remove('typing')
      setStatus(m.reason && m.reason !== 'completed' ? t('status.incomplete', { reason: m.reason }) : '')
    }
    if (m.type === 'mind') loadMind()
  }
  es.onerror = () => setStatus(t('status.reconnect'))
  es.onopen = () => { if (!busy) setStatus('') }
}

function showError(text) {
  const el = $('error')
  el.hidden = !text
  el.textContent = text || ''
}

const input = $('input')
const send = $('send')
async function post(body) {
  const r = await fetch('api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
  if (!r.ok) throw new Error(localizeError(r.error) || t('error.unknown'))
}
async function submit(e) {
  e?.preventDefault()
  const text = input.value.trim()
  if (!text && !pendingPic) return
  send.disabled = true
  showError('')
  try {
    await post(pendingPic ? { text, image: pendingPic } : { text })
    input.value = ''
    input.style.height = ''
    clearPic()
  } catch (err) {
    showError(t('error.send', { msg: err.message }))
  } finally {
    send.disabled = false
    input.focus()
  }
}
$('form').addEventListener('submit', submit)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) submit(e)
})
input.addEventListener('input', () => {
  input.style.height = ''
  // scrollHeight 不含边框，直接拿它当 height 会永远差 2px，滚动条就赖着不走
  input.style.height = Math.min(140, input.scrollHeight + 2) + 'px'
})

// ---------- 表情包和图片 ----------
const panel = $('stickers')
const stickerBtn = $('sticker-btn')
async function openStickers(open) {
  panel.hidden = !open
  stickerBtn.setAttribute('aria-expanded', String(open))
  if (!open) return
  const r = await fetch('api/stickers').then((r) => r.json()).catch(() => ({ stickers: [] }))
  panel.replaceChildren()
  if (!r.stickers.length) {
    const n = document.createElement('div'); n.className = 'none'
    n.textContent = t('stickers.empty')
    return panel.appendChild(n)
  }
  for (const name of r.stickers) {
    const b = document.createElement('button'); b.type = 'button'; b.title = name
    const im = document.createElement('img'); im.src = `api/sticker/${encodeURIComponent(name)}`; im.alt = name; im.loading = 'lazy'; im.width = 66; im.height = 66
    b.append(im, name)
    b.addEventListener('click', async () => {
      openStickers(false)
      try { await post({ sticker: name }) } catch (err) { showError(t('error.sendShort', { msg: err.message })) }
    })
    panel.appendChild(b)
  }
}
stickerBtn.addEventListener('click', () => openStickers(panel.hidden))
// 点别处、或者按 Esc，就收起来
document.addEventListener('click', (e) => {
  if (panel.hidden) return
  if (panel.contains(e.target) || stickerBtn.contains(e.target)) return
  openStickers(false)
})
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!panel.hidden) openStickers(false); if (pendingPic) clearPic() })
// 图先挂在输入框上面，字打完再一起发——以前选完图就直接发出去，想配句话都来不及。
let pendingPic
const pend = $('pending')
const pendImg = $('pending-img')
function clearPic() {
  pendingPic = undefined
  pend.hidden = true
  pendImg.removeAttribute('src')
}
async function stagePic(file) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return showError(t('error.imageType'))
  if (file.size > 4 * 1024 * 1024) return showError(t('error.imageSize'))
  showError('')
  const image = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(file) })
  pendingPic = image
  pendImg.src = image
  pend.hidden = false
  openStickers(false)
  input.focus()
}
$('pending-x').addEventListener('click', clearPic)
$('pic-btn').addEventListener('click', () => $('pic').click())
$('pic').addEventListener('change', (e) => { stagePic(e.target.files[0]); e.target.value = '' })
input.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'))
  if (f) { e.preventDefault(); stagePic(f) }
})

// ---------- 她的小本子 ----------
// 心情词 → 表情图。先看词，词对不上再看分数。
const FACES = [
  ['happy', /开心|高兴|兴奋|雀跃|得意|甜|美滋滋|乐/],
  ['sulk', /委屈|生气|气|哼|不爽|傲娇|别扭|嫌|烦/],
  ['shy', /害羞|不好意思|脸红|羞/],
  ['sad', /难过|伤心|失落|想哭|低落|寂寞|孤单|沮丧/],
  ['sleepy', /困|累|迷糊|没精神|乏/],
  ['surprised', /惊|吓|懵|啊|愣/],
]
function faceOf(feeling = '', score = 65) {
  const hit = FACES.find(([, re]) => re.test(feeling))
  if (hit) return hit[0]
  return score >= 75 ? 'happy' : score <= 40 ? 'sad' : 'calm'
}

// ---------- 她本人：鱼缸里的半身像 ----------
// 有半身图的心情直接用；困、吃惊还没有半身图，半身用平常的，头像用对应表情。
const HALF = new Set(['calm', 'happy', 'shy', 'sulk', 'sad'])
let mood = 'calm'
let poked = 0
function isNight(d = new Date()) { const h = d.getHours(); return h >= 23 || h < 8 }
function setImg(el, src) {
  if (el.getAttribute('src') === src) return
  el.classList.add('swap')
  setTimeout(() => { el.src = src; el.onload = () => el.classList.remove('swap') }, 350)
}
function showHer() {
  if (!who.main) return
  const night = isNight()
  const now = Date.now() < poked ? 'shy' : night ? 'sleepy' : mood
  $('tank').classList.toggle('night', night)
  setImg($('figure'), `art-half-${HALF.has(now) ? now : 'calm'}.webp`)
  $('avatar').src = `art-face-${now === 'shy' ? 'happy' : now}.jpg`
  $('her').title = night ? t('poke.night') : t('poke.title')
  $('figure').alt = t('figure.alt')
}
// 戳一下：害羞 3 秒。只是动画，不会发消息给她。
$('her').addEventListener('click', () => { poked = Date.now() + 3000; showHer(); setTimeout(showHer, 3100) })
setInterval(showHer, 5 * 60 * 1000)

// 空的栏目不占地方，收到最底下一句话里：「还空着：…」
let blanks = new Map()
function fill(id, items, render, emptyText) {
  const el = $(id)
  el.replaceChildren()
  const sec = el.closest('section')
  if (sec) sec.hidden = !items.length
  if (!items.length) {
    const pane = sec?.closest('.pane')
    const arr = blanks.get(pane) ?? []
    arr.push(sec?.querySelector('h2')?.textContent ?? id)
    blanks.set(pane, arr)
    return
  }
  for (const item of items) el.appendChild(render(item))
}
function li(text, time, cls) {
  const el = document.createElement('li')
  if (cls) el.className = cls
  if (time) { const t = document.createElement('time'); t.textContent = time; el.appendChild(t) }
  el.appendChild(document.createTextNode(text))
  return el
}
function relDay(s) {
  const d = new Date(`${s}T00:00:00`)
  const n = new Date()
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return t('time.today')
  if (diff === 1) return t('time.yesterday')
  if (diff > 1 && diff < 7) return t('time.daysAgo', { n: diff })
  return dateText(d)
}
function dayLabel(s) {
  const d = new Date(`${s}T00:00:00`)
  return new Intl.DateTimeFormat(locale(), { month: 'long', day: 'numeric', weekday: 'short' }).format(d)
}
function diaryLine(line) {
  const p = document.createElement('p')
  const m = line.match(/^(\d{1,2}:\d{2})\s*(.*)$/)
  if (m) {
    const t = document.createElement('time'); t.textContent = m[1]
    p.append(t, document.createTextNode(m[2]))
  } else p.textContent = line
  return p
}
const dated = (line) => {
  const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.*)$/)
  return m ? li(m[2], m[1].slice(5)) : li(line)
}

async function loadMind() {
  const m = await fetch('api/mind').then((r) => r.json()).catch(() => undefined)
  if (!m || m.error) return
  blanks = new Map()
  const tank = $('tank')
  tank.style.setProperty('--mood', String(m.mood.score))
  tank.classList.toggle('sulk', m.mood.score < 45)
  const baseNote = m.mood.base !== undefined && m.mood.base !== 65 ? t('mood.base', { base: m.mood.base }) : ''
  tank.title = t('mood.title', { score: m.mood.score, base: baseNote })
  $('mood-word').textContent = feelingLabel(m.mood.feeling)
  mood = faceOf(m.mood.feeling, m.mood.score)
  showHer()
  $('mood-why').textContent = m.mood.why ? t('mood.why', { why: m.mood.why }) : t('mood.none')
  $('doing').textContent = m.doing ? `${t('doing.prefix')}${m.doing}` : ''
  showToday(m.life)
  fill('sensed', m.sensed ?? [], (o) => li(o.text, o.source), t('empty.sensed'))
  const wantLabel = (status) => t(`want.${status === 'let-go' ? 'letgo' : status}`)
  fill('wants', (m.wants ?? []).slice(0, 8), (w) => {
    const el = li(w.what, w.on.slice(5, 10), `lesson want-${w.status}`)
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = wantLabel(w.status)
    el.insertBefore(tag, el.lastChild)
    const why = document.createElement('div'); why.className = 'why'; why.textContent = w.why
    el.appendChild(why)
    return el
  }, t('empty.wants'))
  fill('experiences', (m.experiences ?? []).slice(0, 8), (e) => {
    const el = li(e.what, e.date ? `${e.date.slice(5)} ${e.time}` : '')
    if (e.felt) { const f = document.createElement('div'); f.className = 'why'; f.textContent = e.felt; el.appendChild(f) }
    return el
  }, t('empty.experiences'))
  fill('reminders', m.reminders, (r) => li(r.what, r.when.slice(5), r.done ? 'done' : ''), t('empty.reminders'))
  // 说说：她随手发的（post_moment）和晚上的日记混在一起，按时间倒着排。日记那条标一下「日记」。
  const posts = (m.moments ?? []).map((x) => ({ ...x, kind: 'moment' }))
  for (const d of (m.diary ?? [])) {
    const lines = String(d.text ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
    for (const line of lines) {
      const mm = line.match(/^(\d{1,2}:\d{2})\s*(.*)$/)
      posts.push({ date: d.date, time: mm ? mm[1] : '', text: mm ? mm[2] : line, kind: 'diary' })
    }
  }
  posts.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  fill('diary', posts.slice(0, 12), (p) => {
    const el = document.createElement('article'); el.className = 'post'
    const ava = document.createElement('div'); ava.className = 'ava'
    const main = document.createElement('div'); main.className = 'post-main'
    const meta = document.createElement('div'); meta.className = 'meta'
    const whoEl = document.createElement('b'); whoEl.textContent = who.name
    const when = document.createElement('time'); when.textContent = `${relDay(p.date)}${p.time ? ` ${p.time}` : ''}${p.kind === 'diary' ? t('tag.diary') : ''}`
    meta.append(whoEl, when)
    const body = document.createElement('p'); body.textContent = p.text
    main.append(meta, body)
    if (p.text.length > 90) {
      body.classList.add('clamp')
      const more = document.createElement('button'); more.type = 'button'; more.className = 'more'; more.textContent = t('more')
      more.addEventListener('click', () => { body.classList.remove('clamp'); more.remove() })
      main.appendChild(more)
    }
    el.append(ava, main)
    return el
  }, t('empty.moments'))
  fill('exams', m.exams ?? [], (e) => {
    const el = li(t('exam.caught', { caught: e.caught, total: e.total }), e.date.slice(5), e.rate <= 30 ? 'up' : 'down')
    for (const c of (e.caughtItems ?? []).slice(0, 2)) {
      const q = document.createElement('div'); q.className = 'why'; q.textContent = `「${c.b.replace(/\n+/g, ' ').slice(0, 40)}」${c.why}`
      el.appendChild(q)
    }
    return el
  }, t('empty.exams'))
  const lessonStatus = (status) => t(`lesson.${status}`)
  fill('lessons', m.lessons ?? [], (l) => {
    const el = li(`${l.text}${l.good || l.bad ? `  👍${l.good ?? 0} 👎${l.bad ?? 0}` : ''}`, l.since.slice(5), `lesson ${l.status}`)
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = lessonStatus(l.status)
    el.insertBefore(tag, el.lastChild)
    const why = document.createElement('div'); why.className = 'why'; why.textContent = l.verdict ? t('lesson.verdict', { verdict: l.verdict }) : t('lesson.because', { why: l.why })
    el.appendChild(why)
    return el
  }, t('empty.lessons'))
  fill('wishes', m.wishes ?? [], (w) => {
    const [head, ...rest] = w.split('；')
    const el = li(head.slice(11) || head, head.slice(5, 10))
    if (rest.length) { const why = document.createElement('div'); why.className = 'why'; why.textContent = rest.join('；'); el.appendChild(why) }
    return el
  }, t('empty.wishes'))
  fill('skills', m.skills ?? [], (s) => li(getLang() === 'zh' ? `${s.id}：${s.one}` : `${s.id}: ${s.one}`, ''), t('empty.skills'))
  fill('body', m.body ?? [], (b) => li(getLang() === 'zh' ? `${b.title}：${b.one}` : `${b.title}: ${b.one}`, ''), '')
  fill('proposals', m.proposals ?? [], (r) => {
    const el = li(r.what, r.on.slice(5))
    const why = document.createElement('div'); why.className = 'why'; why.textContent = t('lesson.because', { why: r.why })
    el.appendChild(why)
    return el
  }, t('empty.proposals'))
  fill('owner', m.owner, dated, t('empty.owner'))
  fill('knows', m.knows ?? [], (k) => {
    const wrap = document.createElement('div')
    const t = document.createElement('div'); t.className = 'date'; t.textContent = k.title
    const p = document.createElement('p'); p.textContent = k.text
    wrap.append(t, p)
    return wrap
  }, t('empty.knows'))
  for (const pane of document.querySelectorAll('.pane')) {
    const b = pane.querySelector('.blank')
    const names = blanks.get(pane) ?? []
    if (b) b.textContent = names.length ? t('blank.empty', { names: names.join(listSep()) }) : ''
  }
}

// ---------- 她的本子：从右边拉出来 ----------
let bookReturnFocus
const narrow = () => window.matchMedia('(max-width: 900px)').matches
function setBook(open) {
  document.body.classList.toggle('book-open', open)
  for (const el of document.querySelectorAll('#open-book, .js-open-book')) el.setAttribute('aria-expanded', String(open))
  $('book').inert = !open
  if (open) {
    bookReturnFocus = document.activeElement
    $('book').focus()
  } else if (bookReturnFocus?.focus) {
    bookReturnFocus.focus()
    bookReturnFocus = undefined
  }
}
for (const el of document.querySelectorAll('#open-book, .js-open-book')) el.addEventListener('click', () => setBook(true))
$('close-book').addEventListener('click', () => setBook(false))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('book-open')) setBook(false)
  // 窄屏时抽屉盖住整页，Tab 只在抽屉里转；宽屏不限制。
  if (e.key !== 'Tab' || !document.body.classList.contains('book-open') || !narrow()) return
  const items = [...$('book').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
})
// 点抽屉外面就收起
document.addEventListener('click', (e) => {
  if (!document.body.classList.contains('book-open')) return
  if (e.target.closest('.drawer') || e.target.closest('#open-book, .js-open-book')) return
  setBook(false)
})

// 四个标签页：今天 / 说说 / 你 / 她在学
const panes = [...document.querySelectorAll('.pane')]
const tabButtons = [...document.querySelectorAll('.tabs button')]
function openTab(name, focus = false) {
  document.body.dataset.tab = name
  for (const x of tabButtons) {
    const on = x.dataset.pane === name
    x.classList.toggle('on', on)
    x.setAttribute('aria-selected', String(on))
    x.tabIndex = on ? 0 : -1
    if (on && focus) x.focus()
  }
  for (const pane of panes) pane.hidden = pane.dataset.pane !== name
}
for (const b of tabButtons) {
  b.addEventListener('click', () => openTab(b.dataset.pane))
  b.addEventListener('keydown', (e) => {
    const i = tabButtons.indexOf(b)
    const next = e.key === 'ArrowRight' ? (i + 1) % tabButtons.length
      : e.key === 'ArrowLeft' ? (i - 1 + tabButtons.length) % tabButtons.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? tabButtons.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    openTab(tabButtons[next].dataset.pane, true)
  })
}
const wantedTab = new URLSearchParams(location.search).get('tab')
openTab(tabButtons.some((b) => b.dataset.pane === wantedTab) ? wantedTab : 'today')

// ---------- 活跃度滑条 ----------
let levels = []
function showLevel(n) {
  const l = levels[n]
  if (!l) return
  $('level-name').textContent = l.name
  $('level-desc').textContent = l.desc
}
async function loadLevel() {
  const r = await fetch('api/level').then((x) => x.json()).catch(() => undefined)
  if (!r || r.error) return
  levels = r.levels.map((l, i) => (getLang() === 'en' ? (LEVELS_EN[i] ?? l) : l))
  $('level').max = String(levels.length - 1)
  $('level').value = String(r.level)
  showLevel(r.level)
}
$('level').addEventListener('input', () => showLevel(Number($('level').value)))
$('level').addEventListener('change', async () => {
  const level = Number($('level').value)
  const r = await fetch('api/level', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level }) }).then((x) => x.json()).catch(() => undefined)
  if (!r || r.error) return loadLevel()
  showLevel(r.level)
  loadMind()
})
loadLevel()

// 滑条管的是「今天最多几次」，平时看不出来；这里把今天用了几次、下一次大概什么时候写出来。
function showToday(l) {
  const el = $('level-today')
  if (!l) return (el.textContent = '')
  const hm = (t) => { const d = new Date(Math.max(t, Date.now())); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
  const parts = [t('level.today.nudge', { count: l.count, limit: l.limit })]
  if (l.ownLimit === undefined) return (el.textContent = parts.join(listSep()))
  parts.push(t('level.today.own', { own: l.own, limit: l.ownLimit }))
  if (l.ownLimit === 0) parts.push(t('level.today.noOwn'))
  else if (l.own >= l.ownLimit) parts.push(t('level.today.usedOwn'))
  else parts.push(t('level.today.random'))
  el.textContent = parts.join(listSep())
}

async function switchLang(next) {
  if (!['zh', 'en'].includes(next) || next === getLang()) return
  setLang(next)
  try { localStorage.setItem(LANG_KEY, next) } catch {}
  applyStatic()
  if (!who.main) $('figure').alt = t('plain.alt', { name: who.name })
  showHer()
  resetHistory()
  await loadHistory()
  await Promise.all([loadLevel(), loadMind()])
  if (busy) setStatus(t('status.typing'), true)
}
for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => switchLang(b.dataset.lang))

whoReady.then(() => { if (!who.modules.length) document.querySelector('.drawer-foot').hidden = true })
loadHistory().then(listen)
loadMind()
setInterval(loadMind, 60_000)
if (new URLSearchParams(location.search).has('open')) setBook(true)
