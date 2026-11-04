# Chrome DevTools MCP (optional)

This is not our plugin. It is a setup for [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp), the browser MCP used by the optional `use_hands` feature.

The original deployment used a local `node_modules` copy so DSH would not depend on `npx` or a global PATH. This folder does the same thing in a reproducible way.

## Install

```bash
cd extras/chrome
npm install
```

Then copy `cordis.patch.example.yml` into your DSH profile patch and replace:

- `/ABSOLUTE/PATH` with the absolute path to this checkout;
- `/path/to/node` with the Node binary DSH uses (on macOS, `which node` is usually fine; `/opt/homebrew/bin/node` on Apple Silicon Homebrew).

Restart DSH. The browser tools appear as `mcp__chrome__*` in sessions that have the MCP row.

## Notes

- The MCP opens a separate Chrome window with its own profile under `~/.cache/chrome-devtools-mcp/`; logins there persist.
- The companion hides `mcp__chrome__*` from her own tool list; only the hands child session uses them.
- `failOnStartupError: false` keeps DSH usable if Chrome cannot start.
- Do not commit `node_modules/`. It is ignored by the root `.gitignore`.
