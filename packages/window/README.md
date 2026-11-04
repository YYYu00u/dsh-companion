# @dsh-companion/window

A QQ-like standalone chat window for the companion. The page is served at `/companion-window/` and talks to the web plugin's `/companion/api/*`, so the transcript is the same.

It opens from the desktop pet's right-click menu (**More / Chat with her**), or from the URL directly. The window itself is Electron (the copy bundled with DSH at `~/.dsh/electron`); if Electron is unavailable it falls back to Chrome `--app`, then the default browser.

## Status

The page and the Electron window were both exercised (the app has a `--shot` mode used for the screenshot). The pet menu registration is best-effort: without `dsh-pet` the window still opens from the URL, but the right-click item is not there.

The window UI is Chinese-first; unlike the web room it does not have the 中/EN switch yet.

## Install

1. Install `@dsh-companion/core` and `@dsh-companion/web` first.
2. Install this bundle; it serves `/companion-window/` on the DSH port.
3. Restart DSH.
4. Right-click the desktop pet → **More / Chat with her**, or open `http://<DSH host>/companion-window/`.

Config:

```yaml
- id: dsh-companion-window
  name: '@dsh-companion/window'
  config:
    home: ~/.dsh-companion
    name: 大肥鱼
    chatBase: /companion
    # menuOwner: 大肥鱼
    # menuLabel: 和她聊天
    # electron: /path/to/Electron
```

## Notes

- `home` is used for the window's Electron `userData` (`<home>/.data/chat-window`), not for chat data.
- The page only allows navigation within the DSH origin; external links open in the default browser.
- Only one window is allowed; a second launch focuses the existing one.
