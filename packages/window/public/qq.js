// 大肥鱼的聊天窗。接口和完整页面一样：api/history、api/events、api/send、api/stickers、api/mind（<base> 指到 /companion/）。
const $ = (id) => document.getElementById(id)
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x }
const list = $('list'), statusEl = $('status'), input = $('input'), send = $('send')
let who = { name: '大肥鱼', main: true }
const seen = new Set()
let lastTime = 0, lastSide = '', busy = false, mind

fetch('api/who').then((r) => r.json()).then((w) => {
  if (w?.name) who = w
  document.title = who.name
  $('name').textContent = who.name
  $('card-name').textContent = who.name
  input.placeholder = `跟${who.name}说点什么`
  if (!who.main) {
    document.body.classList.add('plain')
    for (const id of ['her-ava', 'card-ava']) $(id).textContent = [...who.name][0]
  }
}).catch(() => {})

// ---------- 她的样子跟着心情换 ----------
const FACES = [['happy', /开心|高兴|兴奋|得意|甜|乐/], ['sulk', /委屈|生气|气|哼|不爽|别扭|烦/], ['sad', /难过|伤心|失落|想哭|低落|寂寞/], ['sleepy', /困|累|迷糊/], ['surprised', /惊|吓|懵|愣/]]
function face(feeling = '', score = 65) {
  const h = new Date().getHours()
  if (h >= 23 || h < 8) return 'sleepy'
  const hit = FACES.find(([, re]) => re.test(feeling))
  return hit ? hit[0] : score >= 75 ? 'happy' : score <= 40 ? 'sad' : 'calm'
}
const HALF = new Set(['calm', 'happy', 'sulk', 'sad'])
let faceNow = 'calm'
function setImg(img, src) {
  if (img.getAttribute('src') === src) return
  img.classList.add('swap')
  setTimeout(() => { img.src = src; img.onload = () => img.classList.remove('swap') }, 300)
}
const faceSrc = () => `art-face-${faceNow}.jpg`

async function loadMind() {
  const m = await fetch('api/mind').then((r) => r.json()).catch(() => undefined)
  if (!m || m.error) return
  mind = m
  $('mood-word').textContent = m.mood?.feeling ?? ''
  $('mood-why').textContent = m.mood?.why ? `因为${m.mood.why}` : ''
  $('doing').textContent = m.doing ? `她${m.doing}` : ''
  if (!busy) setStatus(m.doing ? `她${m.doing}` : '')
  $('card-mood').textContent = [m.mood?.feeling && `${m.mood.feeling}${m.mood.why ? `，因为${m.mood.why}` : ''}`, m.doing && `她${m.doing}`].filter(Boolean).join('　')
  if (who.main && m.mood) {
    faceNow = face(m.mood.feeling, m.mood.score)
    for (const im of document.querySelectorAll('.her-ava img')) im.src = faceSrc()
    setImg($('figure'), `art-half-${HALF.has(faceNow) ? faceNow : 'calm'}.webp`)
  }
  showLatest()
  if (!$('card').hidden) fillCard()
}

// ---------- 说说：她自己发的 + 晚上的日记 ----------
const relDay = (s) => {
  const d = new Date(`${s}T00:00:00`), n = new Date()
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - d) / 86400000)
  const WEEK = '日一二三四五六'
  return diff === 0 ? '今天' : diff === 1 ? '昨天' : diff < 7 ? `星期${WEEK[d.getDay()]}` : `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
function posts() {
  const m = mind ?? {}
  const out = (m.moments ?? []).map((x) => ({ ...x, kind: 'moment' }))
  for (const d of m.diary ?? []) {
    // 一天的日记是一条，不拆成好几条
    const text = String(d.text ?? '').trim().replace(/^(\d{1,2}:\d{2})\s*/, '')
    const time = String(d.text ?? '').trim().match(/^(\d{1,2}:\d{2})/)?.[1] ?? ''
    if (text) out.push({ date: d.date, time, text, kind: 'diary' })
  }
  return out.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}
function showLatest() {
  const box = $('latest'); box.replaceChildren()
  const p = posts()[0]
  if (!p) return box.appendChild(el('div', 'none', '她还没发过说说'))
  box.append(el('p', '', p.text), el('time', '', `${relDay(p.date)} ${p.time}${p.kind === 'diary' ? ' 的日记' : ''}`))
}
function postEl(p) {
  const a = el('article', `post ${p.kind}`)
  const ava = el('span', 'ava her-ava')
  if (who.main) { const im = el('img'); im.src = faceSrc(); im.alt = ''; ava.appendChild(im) } else ava.textContent = [...who.name][0]
  const main = el('div', 'post-main')
  const meta = el('div', 'post-meta')
  meta.append(el('b', '', who.name), el('span', '', p.time))
  if (p.kind === 'diary') meta.appendChild(el('span', 'tag', '日记'))
  const body = el('p', '', p.text)
  main.append(meta, body)
  if (p.text.length > 120) {
    body.classList.add('clamp')
    const open = el('button', 'open', '展开')
    open.type = 'button'
    open.addEventListener('click', () => { const c = body.classList.toggle('clamp'); open.textContent = c ? '展开' : '收起' })
    main.appendChild(open)
  }
  a.append(ava, main)
  return a
}

// ---------- 资料卡 ----------
function fillCard() {
  const m = mind ?? {}
  if (who.main) $('cover').style.backgroundImage = `url(${new URL('art-bg-tank.jpg', document.baseURI).href})`
  // 说说：按天分组，同一天的放一起
  const box = $('card-moments'); box.replaceChildren()
  const ps = posts().slice(0, 40)
  if (!ps.length) box.appendChild(el('div', 'none', '她还没发过说说'))
  let day = ''
  for (const p of ps) {
    if (p.date !== day) { day = p.date; box.appendChild(el('div', 'day', relDay(p.date))) }
    box.appendChild(postEl(p))
  }
  // 她在想
  const t = $('card-thinking'); t.replaceChildren(); t.classList.add('think')
  const section = (title, items) => {
    if (!items.length) return
    t.appendChild(el('h3', '', title))
    const ul = el('ul')
    for (const [main, sub] of items) { const li = el('li', '', main); if (sub) li.appendChild(el('small', '', sub)); ul.appendChild(li) }
    t.appendChild(ul)
  }
  section('想做的事', (m.wants ?? []).filter((w) => w.status === 'want' || w.status === 'doing').map((w) => [w.what, w.status === 'doing' ? '在做' : w.why]))
  section('最近做了什么', (m.experiences ?? []).slice(0, 6).map((e) => [e.what, [e.date && `${relDay(e.date)} ${e.time ?? ''}`, e.felt].filter(Boolean).join('　')]))
  section('在试着改的', (m.lessons ?? []).filter((l) => l.status === 'trial').slice(0, 5).map((l) => [l.text, '']))
  if (!t.children.length) t.appendChild(el('div', 'none', '她还没想什么'))
}
let lastFocus
function openCard(open, tab) {
  $('card').hidden = !open
  if (open) {
    lastFocus = document.activeElement
    fillCard()
    if (tab) pickTab(tab)
    $('card-x').focus()
  } else lastFocus?.focus?.()
}
function pickTab(name) {
  for (const x of document.querySelectorAll('.card-tabs button')) x.setAttribute('aria-selected', String(x.dataset.tab === name))
  $('card-moments').hidden = name !== 'moments'
  $('card-thinking').hidden = name !== 'thinking'
}
for (const id of ['who-btn', 'figure-btn', 'card-btn']) $(id).addEventListener('click', () => openCard(true))
$('all-moments').addEventListener('click', () => openCard(true, 'moments'))
$('card-x').addEventListener('click', () => openCard(false))
$('card').addEventListener('click', (e) => { if (e.target === $('card')) openCard(false) })
for (const b of document.querySelectorAll('.card-tabs button')) b.addEventListener('click', () => pickTab(b.dataset.tab))

// ---------- 聊天 ----------
const pad = (n) => String(n).padStart(2, '0')
function when(t) {
  const d = new Date(t), now = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return hm
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}
function setStatus(text, typing = false) { statusEl.textContent = text; statusEl.classList.toggle('typing', typing) }
// 只有本来就在底部（或者是自己刚发的）才跟着滚，往上翻记录的时候不打断
const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80
const scrollDown = () => { list.scrollTop = list.scrollHeight }

function avatar(side, ghost) {
  const a = el('span', `ava ${side === 'me' ? 'me-ava' : 'her-ava'}${ghost ? ' ghost' : ''}`)
  if (side === 'me') a.textContent = '我'
  else if (who.main) { const im = el('img'); im.src = faceSrc(); im.alt = ''; a.appendChild(im) }
  else a.textContent = [...who.name][0]
  if (side !== 'me') { a.title = '看她的资料'; a.addEventListener('click', () => openCard(true)) }
  return a
}

let typingRow
function showTyping(on) {
  if (on && !typingRow) {
    const stick = nearBottom()
    typingRow = el('div', 'row her typing-row')
    const b = el('div', 'bubble'); b.append(el('i'), el('i'), el('i'))
    typingRow.append(avatar('her', false), b)
    list.appendChild(typingRow)
    if (stick) scrollDown()
  } else if (!on && typingRow) { typingRow.remove(); typingRow = undefined }
}

function add(row, live) {
  if (seen.has(row.seq)) return
  seen.add(row.seq)
  $('empty')?.remove()
  const stick = !live || nearBottom() || row.side === 'me'
  const tr = typingRow; if (tr) tr.remove()
  if (row.time - lastTime > 5 * 60_000) {
    const g = el('div', 'gap'); g.appendChild(el('span', '', when(row.time))); list.appendChild(g)
    lastSide = ''
  }
  lastTime = row.time
  const cont = lastSide === row.side
  const r = el('div', `row ${row.side}${cont ? ' cont' : ''}${live ? ' fresh' : ''}`)
  r.appendChild(avatar(row.side, cont))
  const src = row.sticker ? `api/sticker/${encodeURIComponent(row.sticker)}` : row.pic ? `api/pic/${row.pic}` : ''
  let b
  if (src) {
    b = el('div', `bubble pic${row.pic ? ' photo' : ''}`)
    const im = el('img'); im.src = src; im.alt = row.sticker ?? '图片'; im.title = im.alt
    im.addEventListener('load', () => { if (stick) scrollDown() }, { once: true })
    b.appendChild(im)
  } else {
    b = el('div', row.side === 'her' && /^[（(].*[）)]$/.test(row.text) ? 'bubble aside' : 'bubble', row.text)
  }
  r.appendChild(b)
  list.appendChild(r)
  if (src && row.text && !row.sticker) {
    const c = el('div', `row ${row.side} cont`); c.append(avatar(row.side, true), el('div', 'bubble', row.text)); list.appendChild(c)
  }
  lastSide = row.side
  if (tr && busy) { typingRow = tr; list.appendChild(tr) }
  if (stick) scrollDown()
}

async function loadHistory() {
  const r = await fetch('api/history').then((x) => x.json()).catch((e) => ({ error: e.message }))
  if (r.error) return showError(`读不到聊天记录：${r.error}。等一下再开。`)
  if (!r.rows.length) list.appendChild(el('div', 'empty', `跟${who.name}打个招呼吧`)).id = 'empty'
  r.rows.forEach((row) => add(row, false))
  busy = r.busy
  if (busy) { setStatus('正在输入…', true); showTyping(true) }
}
function listen() {
  const es = new EventSource('api/events')
  es.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'row') add(m.row, true)
    if (m.type === 'typing') { busy = true; setStatus('正在输入…', true); showTyping(true) }
    if (m.type === 'idle') {
      busy = false; showTyping(false)
      setStatus(m.reason && m.reason !== 'completed' ? `她没说完（${m.reason}）` : (mind?.doing ? `她${mind.doing}` : ''))
    }
    if (m.type === 'mind') loadMind()
  }
  es.onerror = () => setStatus('连不上了，正在重连')
  es.onopen = () => { if (!busy) setStatus(mind?.doing ? `她${mind.doing}` : '') }
}
function showError(text) { const e = $('error'); e.hidden = !text; e.textContent = text || '' }

async function post(body) {
  const r = await fetch('api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json())
  if (!r.ok) throw new Error(r.error || '没有回应')
}
let pendingPic
const canSend = () => { send.disabled = !input.value.trim() && !pendingPic }
async function submit(e) {
  e?.preventDefault()
  const text = input.value.trim()
  if (!text && !pendingPic) return
  send.disabled = true
  showError('')
  try {
    await post(pendingPic ? { text, image: pendingPic } : { text })
    input.value = ''
    clearPic()
  } catch (err) {
    showError(`没发出去：${err.message}。字还在输入框里，可以再按一次发送。`)
  } finally {
    canSend()
    input.focus()
  }
}
$('form').addEventListener('submit', submit)
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) submit(e) })
input.addEventListener('input', canSend)

// ---------- 表情包 ----------
const panel = $('stickers'), stickerBtn = $('sticker-btn')
async function openStickers(open) {
  panel.hidden = !open
  stickerBtn.setAttribute('aria-expanded', String(open))
  if (!open) return
  const r = await fetch('api/stickers').then((x) => x.json()).catch(() => ({ stickers: [] }))
  panel.replaceChildren()
  if (!r.stickers.length) return panel.appendChild(el('div', 'none', '还没有表情包。发她一张图，她喜欢就会存起来。'))
  for (const name of r.stickers) {
    const b = el('button'); b.type = 'button'; b.title = `发「${name}」`
    const im = el('img'); im.src = `api/sticker/${encodeURIComponent(name)}`; im.alt = name; im.loading = 'lazy'
    b.append(im, name)
    b.addEventListener('click', async () => { openStickers(false); try { await post({ sticker: name }) } catch (err) { showError(`没发出去：${err.message}`) } })
    panel.appendChild(b)
  }
  panel.querySelector('button')?.focus()
}
stickerBtn.addEventListener('click', () => openStickers(panel.hidden))
document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && !stickerBtn.contains(e.target)) openStickers(false) })

// ---------- 发图：选、粘贴、拖进来都行，先挂在输入框上面，配好字一起发 ----------
const pend = $('pending'), pendImg = $('pending-img'), foot = $('foot')
function clearPic() { pendingPic = undefined; pend.hidden = true; pendImg.removeAttribute('src'); canSend() }
async function stagePic(file) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return showError('只能发 png、jpg、webp、gif 图片')
  if (file.size > 4 * 1024 * 1024) return showError('这张图超过 4MB 了，换一张小一点的')
  showError('')
  pendingPic = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file) })
  pendImg.src = pendingPic; pend.hidden = false
  openStickers(false); canSend(); input.focus()
}
$('pending-x').addEventListener('click', clearPic)
$('pic-btn').addEventListener('click', () => $('pic').click())
$('pic').addEventListener('change', (e) => { stagePic(e.target.files[0]); e.target.value = '' })
input.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); stagePic(f) } })
let dragDepth = 0
document.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { dragDepth++; foot.classList.add('dragging') } })
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; foot.classList.remove('dragging') } })
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; foot.classList.remove('dragging'); const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith('image/')); if (f) stagePic(f) })

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (!$('card').hidden) openCard(false)
  else if (!panel.hidden) { openStickers(false); stickerBtn.focus() }
  else if (pendingPic) clearPic()
})

loadMind().then(() => { if (location.hash === '#card') openCard(true) }).then(loadHistory).then(listen)
setInterval(loadMind, 5 * 60_000)
input.focus()
