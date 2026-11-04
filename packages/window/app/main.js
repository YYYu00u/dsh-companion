// 大肥鱼的聊天窗：一个单独的应用窗口（不是浏览器），里面开 /companion-window/。插件 @dsh-companion/window 启动它。
// 用桌宠自带的 Electron（~/.dsh/electron/Electron.app）跑：
//   Electron <本目录> --url=http://127.0.0.1:<DSH 端口>/companion-window/ --data=<她家>/.data/chat-window
// 已经开着就把窗口叫到前面，不再开第二个。
const { app, BrowserWindow, shell, nativeImage } = require('electron')
const { join } = require('node:path')

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3)
const url = arg('url')
const data = arg('data')
const name = arg('name') || '大肥鱼'
if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) { console.error('need --url=http://127.0.0.1:<port>/...'); app.exit(2) }
if (data) app.setPath('userData', data)
app.setName(name)

if (!app.requestSingleInstanceLock()) app.exit(0)
let win
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() } })

// 测试用：--shot=<png> 时开好页面截一张窗口的图就退出（只截这个窗口，不截屏幕）
const shot = arg('shot')
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 780, height: 680, minWidth: 360, minHeight: 420,
    title: name, backgroundColor: '#f2f3f5', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.setMenuBarVisibility(false)
  win.setTitle('大肥鱼')
  win.once('ready-to-show', () => win.show())
  // 页面里「打开完整页面」这类新窗口链接：交给默认浏览器，不在这个窗口里开
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:/.test(u)) shell.openExternal(u); return { action: 'deny' } })
  // 只允许留在她自己的页面上
  const origin = new URL(url).origin
  win.webContents.on('will-navigate', (e, u) => { if (new URL(u).origin !== origin) { e.preventDefault(); shell.openExternal(u) } })
  win.loadURL(url)
  if (shot) win.webContents.once('did-finish-load', () => setTimeout(async () => {
    const img = await win.webContents.capturePage()
    require('node:fs').writeFileSync(shot, img.toPNG())
    app.quit()
  }, 4000))
})
app.on('window-all-closed', () => app.quit())
