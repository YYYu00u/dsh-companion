// UI strings for the web room. The character's own words, diary, and memories are
// data and are never translated here; only the chrome around them.
//
// app.js imports this as an ES module. `t()` is safe in Node for tests; the DOM
// helpers only run when called from the browser.

const zh = {
  'meta.description': '住在本地的陪伴角色，有自己的本子、心情、记忆和日子。',
  'book.openShort': '她的小本子',
  'pending.remove': '不发这张',
  'image.pending': '要发的图',
  'sticker.title': '表情包',
  'pic.title': '发图片',
  'compose.placeholder': '跟她说点什么…',
  'compose.hint': '回车发送，Shift+回车换行',
  'compose.aria': '跟她说的话',
  send: '发送',
  'stage.aria': '她',
  'figure.title': '戳她一下',
  'figure.alt': '她现在的样子',
  'book.openLong': '翻开她的本子',
  'book.title': '她的小本子',
  'tab.today': '今天',
  'tab.moments': '说说',
  'tab.you': '你',
  'tab.learn': '她在学',
  'book.close': '收起',
  'sec.sensed': '她感觉到的',
  'sec.reminders': '她惦记着',
  'sec.wants': '她想做的事',
  'sec.experiences': '她的经历',
  'sec.moments': '她的说说',
  'sec.proposals': '她想改自己，等你点头',
  'sec.knows': '她了解的你',
  'sec.owner': '她记得你',
  'sec.wishes': '她想长的新本事',
  'sec.skills': '她的手学会的',
  'sec.lessons': '她学到的',
  'sec.body': '她的身体',
  'sec.exams': '她的体检',
  'level.title': '越往右她自己做的事越多，花的 token 也越多',
  'level.label': '她多活跃',
  'lang.group': '语言',
  'lang.zh': '中',
  'lang.en': 'EN',
  'lang.switchZh': '切换到中文',
  'lang.switchEn': 'Switch to English',
  'empty.chat': '她在你电脑里打盹<br>先跟她打个招呼',
  'image.open': '{alt}（点开看大图）',
  'image.alt': '图片',
  'time.today': '今天',
  'time.yesterday': '昨天',
  'time.daysAgo': '{n} 天前',
  'status.typing': '对方正在输入',
  'status.incomplete': '她没说完（{reason}）',
  'status.reconnect': '连不上了，正在重连',
  'error.unknown': '未知错误',
  'error.send': '没发出去：{msg}。消息还在输入框里，可以再发一次。',
  'error.sendShort': '没发出去：{msg}',
  'error.history': '读聊天记录失败：{error}',
  'stickers.empty': '还没有表情包。点 ＋ 发她一张图，她喜欢就会存起来；也可以直接把图放进她家（home）的 stickers/ 目录，文件名就是名字。',
  'error.imageType': '只能发 png、jpg、webp、gif 图片',
  'error.imageSize': '图太大了，4MB 以内',
  'mood.title': '心情 {score} / 100{base}',
  'mood.base': '，这两天的底色 {base}',
  'mood.why': '因为{why}',
  'mood.none': '没什么特别的事',
  'doing.prefix': '她',
  'feeling.happy': '开心',
  'feeling.sweet': '甜蜜',
  'feeling.clingy': '黏人',
  'feeling.steady': '踏实',
  'feeling.bored': '无聊',
  'feeling.sleepy': '困',
  'feeling.worried': '担心',
  'feeling.hurt': '委屈',
  'feeling.sad': '难过',
  'feeling.angry': '生气',
  'empty.sensed': '她现在什么也没感觉到',
  'empty.wants': '她自己想做的事会写在这里',
  'empty.experiences': '你不在的时候她做了什么，会记在这里',
  'empty.reminders': '你说以后要发生的事，她会记在这里，到时候来问你',
  'empty.moments': '她还没发过说说',
  'empty.exams': '每晚把她的话和真人闲聊混在一起，让旁观者猜哪句是 AI',
  'empty.lessons': '她每天晚上反思一次，学到的写在这里',
  'empty.wishes': '她做不到的事会记在这里，等你帮她装',
  'empty.skills': '她的手做成一件新事，就会把做法记在这里',
  'empty.proposals': '她觉得自己性格哪里该改，会写在这里等你点头',
  'empty.owner': '聊着聊着她就记住了',
  'empty.knows': '她每天晚上整理一次，觉得摸清你哪方面了就写在这里',
  'want.want': '想做',
  'want.doing': '在做',
  'want.done': '做完了',
  'want.letgo': '不想做了',
  'tag.diary': ' · 日记',
  more: '全文',
  'exam.caught': '像机器 {caught}/{total}',
  'lesson.trial': '试用',
  'lesson.kept': '留下',
  'lesson.dropped': '扔掉',
  'lesson.verdict': '结论：{verdict}',
  'lesson.because': '因为{why}',
  'blank.empty': '还空着：{names}',
  'level.today.nudge': '今天主动找你 {count}/{limit} 次',
  'level.today.own': '自己的时间 {own}/{limit} 段',
  'level.today.noOwn': '这一档没有自己的时间',
  'level.today.usedOwn': '今天的自己的时间用完了',
  'level.today.random': '你不在的时候她会随机去做自己的事',
  'poke.night': '她睡了，轻点',
  'poke.title': '戳她一下',
  'plain.alt': '{name}还没有样子',
  'server.empty': '消息是空的',
  'server.tooLong': '太长了',
  'server.imageTooBig': '图太大了，4MB 以内',
  'server.imageType': '只能发 png、jpg、webp、gif 图片',
  'server.noSticker': '没有这个表情',
  'server.busy': '她正在说话，等她说完再来',
  'server.crossSite': '只接受本页发来的请求',
  'server.noPerson': '没有这个人',
  'server.badRequest': '请求看不懂',
  'server.reflectOff': '她没开晚上反思',
  'server.notFound': '找不到',
}

const en = {
  'meta.description': 'A local companion with her own notebook, moods, memories, and days.',
  'book.openShort': 'Her notebook',
  'pending.remove': "Don't send this",
  'image.pending': 'Image to send',
  'sticker.title': 'Stickers',
  'pic.title': 'Send an image',
  'compose.placeholder': 'Say something…',
  'compose.hint': 'Enter to send, Shift+Enter for a new line',
  'compose.aria': 'Message to her',
  send: 'Send',
  'stage.aria': 'Her',
  'figure.title': 'Poke her',
  'figure.alt': 'Her current look',
  'book.openLong': 'Open her notebook',
  'book.title': 'Her notebook',
  'tab.today': 'Today',
  'tab.moments': 'Moments',
  'tab.you': 'You',
  'tab.learn': 'Learning',
  'book.close': 'Close',
  'sec.sensed': 'What she senses',
  'sec.reminders': 'On her mind',
  'sec.wants': 'Things she wants to do',
  'sec.experiences': 'Her days',
  'sec.moments': 'Her moments',
  'sec.proposals': 'She wants to change — waiting for you',
  'sec.knows': 'What she knows about you',
  'sec.owner': 'What she remembers',
  'sec.wishes': 'Skills she wishes for',
  'sec.skills': 'What her hands learned',
  'sec.lessons': 'What she learned',
  'sec.body': 'Her body',
  'sec.exams': 'Her checkups',
  'level.title': 'The further right, the more she does on her own — and the more tokens she spends.',
  'level.label': 'How active',
  'lang.group': 'Language',
  'lang.zh': '中',
  'lang.en': 'EN',
  'lang.switchZh': 'Switch to Chinese',
  'lang.switchEn': 'Switch to English',
  'empty.chat': "She's napping in your computer<br>Say hi to wake her up",
  'image.open': '{alt} (open full size)',
  'image.alt': 'Image',
  'time.today': 'Today',
  'time.yesterday': 'Yesterday',
  'time.daysAgo': '{n} days ago',
  'status.typing': 'typing…',
  'status.incomplete': 'She stopped ({reason})',
  'status.reconnect': 'Connection lost, reconnecting',
  'error.unknown': 'Unknown error',
  'error.send': "Couldn't send: {msg}. Your message is still in the box; you can try again.",
  'error.sendShort': "Couldn't send: {msg}",
  'error.history': "Couldn't load the chat: {error}",
  'stickers.empty': "No stickers yet. Tap ＋ to send her an image; if she likes it she'll keep it. You can also drop images into her home's stickers/ folder, named after the sticker.",
  'error.imageType': 'Only png, jpg, webp, or gif images are supported',
  'error.imageSize': 'Image is too large (max 4 MB)',
  'mood.title': 'Mood {score} / 100{base}',
  'mood.base': ', base {base}',
  'mood.why': 'Because {why}',
  'mood.none': 'Nothing special',
  'doing.prefix': '',
  'feeling.happy': 'Happy',
  'feeling.sweet': 'Sweet',
  'feeling.clingy': 'Clingy',
  'feeling.steady': 'Steady',
  'feeling.bored': 'Bored',
  'feeling.sleepy': 'Sleepy',
  'feeling.worried': 'Worried',
  'feeling.hurt': 'Hurt',
  'feeling.sad': 'Sad',
  'feeling.angry': 'Angry',
  'empty.sensed': "She doesn't sense anything right now",
  'empty.wants': 'Things she wants to do will show up here',
  'empty.experiences': 'What she did while you were away will show up here',
  'empty.reminders': "Things you said would happen later; she'll remember and ask",
  'empty.moments': "She hasn't posted anything yet",
  'empty.exams': 'Every night her lines are mixed with human chat and a judge guesses which are AI',
  'empty.lessons': 'She reflects every night; what she learns shows up here',
  'empty.wishes': "Things she can't do yet; she'll ask you to install them",
  'empty.skills': 'When her hands learn something new, the recipe shows up here',
  'empty.proposals': 'When she thinks her character should change, she writes it here for your approval',
  'empty.owner': "She'll remember as you talk",
  'empty.knows': 'She sorts this out every night; when she figures something out about you, it shows up here',
  'want.want': 'Wants to',
  'want.doing': 'Doing',
  'want.done': 'Done',
  'want.letgo': 'Dropped',
  'tag.diary': ' · diary',
  more: 'More',
  'exam.caught': 'Flagged {caught}/{total}',
  'lesson.trial': 'Trial',
  'lesson.kept': 'Kept',
  'lesson.dropped': 'Dropped',
  'lesson.verdict': 'Verdict: {verdict}',
  'lesson.because': 'Because {why}',
  'blank.empty': 'Empty: {names}',
  'level.today.nudge': 'Reached out {count}/{limit} times today',
  'level.today.own': 'Own time {own}/{limit}',
  'level.today.noOwn': 'No own time at this level',
  'level.today.usedOwn': 'Own time used up for today',
  'level.today.random': "She does her own things while you're away",
  'poke.night': "She's asleep, be gentle",
  'poke.title': 'Poke her',
  'plain.alt': "{name} doesn't have a look yet",
  'server.empty': 'Message is empty',
  'server.tooLong': 'Too long',
  'server.imageTooBig': 'Image is too large (max 4 MB)',
  'server.imageType': 'Only png, jpg, webp, gif images are supported',
  'server.noSticker': 'No such sticker',
  'server.busy': 'She is talking; wait until she finishes',
  'server.crossSite': 'Only requests from this page are accepted',
  'server.noPerson': 'No such person',
  'server.badRequest': 'Could not read the request',
  'server.reflectOff': 'Reflection is off for her',
  'server.notFound': 'Not found',
}

export const DICT = { zh, en }
export const LANGS = ['zh', 'en']

/** English level labels; Chinese comes from the server. */
export const LEVELS_EN = [
  { name: 'Chat only', desc: 'She only speaks when spoken to. No nudges, no own time, no evening reflection.' },
  { name: 'Quiet', desc: 'Reminders and an evening diary; up to 4 nudges a day.' },
  { name: 'Normal', desc: 'Adds the evening checkup and 2 own-time windows.' },
  { name: 'Lively', desc: '4 own-time windows; up to 16 nudges a day.' },
  { name: 'Full', desc: '6 own-time windows; more background in each reply.' },
]

const SERVER_KEYS = {
  '消息是空的': 'server.empty',
  '太长了': 'server.tooLong',
  '图太大了，4MB 以内': 'server.imageTooBig',
  '只能发 png、jpg、webp、gif 图片': 'server.imageType',
  '没有这个表情': 'server.noSticker',
  '她正在说话，等她说完再来': 'server.busy',
  '只接受本页发来的请求': 'server.crossSite',
  '没有这个人': 'server.noPerson',
  '请求看不懂': 'server.badRequest',
  '她没开晚上反思': 'server.reflectOff',
  'not found': 'server.notFound',
}

const FEELINGS = {
  '开心': 'feeling.happy',
  '甜蜜': 'feeling.sweet',
  '黏人': 'feeling.clingy',
  '踏实': 'feeling.steady',
  '无聊': 'feeling.bored',
  '困': 'feeling.sleepy',
  '担心': 'feeling.worried',
  '委屈': 'feeling.hurt',
  '难过': 'feeling.sad',
  '生气': 'feeling.angry',
}

let current = 'zh'

export function getLang() {
  return current
}

export function setLang(lang) {
  if (!DICT[lang]) return current
  current = lang
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  return current
}

/** Pick a language from ?lang=, then the browser. Saved preference is handled by app.js. */
export function detectLang(search = '', navigatorLanguage = '') {
  const fromUrl = new URLSearchParams(search).get('lang')
  if (DICT[fromUrl]) return fromUrl
  return String(navigatorLanguage).toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function t(key, vars = {}) {
  const text = DICT[current]?.[key] ?? DICT.zh[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ''))
}

export function localizeError(message) {
  const key = SERVER_KEYS[String(message ?? '').trim()]
  return key ? t(key) : String(message ?? '')
}

export function feelingLabel(feeling) {
  const key = FEELINGS[feeling]
  return key ? t(key) : feeling
}

/** Translate elements marked with data-i18n / data-i18n-title / -aria / -placeholder / -alt. */
export function applyStatic(root = document) {
  if (!root?.querySelectorAll) return
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle))
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria))
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder))
  for (const el of root.querySelectorAll('[data-i18n-alt]')) el.setAttribute('alt', t(el.dataset.i18nAlt))
  const meta = root.querySelector?.('meta[name="description"]')
  if (meta) meta.setAttribute('content', t('meta.description'))
  for (const b of root.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === current))
}
