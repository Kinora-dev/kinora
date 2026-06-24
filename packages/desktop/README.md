# @kinora/desktop

Desktop app (Electron). Two things in one shell:

- **Local trace viewer** - open any local `trace.zip` (no account, no server). A
  self-contained replacement for `playwright show-trace`.
- **Account dashboard** - sign in to a kinora server and browse your projects

## Why Electron

The viewer is the vendored Playwright trace engine: a Vue app plus a service worker that
reads `trace.zip` over HTTP Range. Electron bundles its own Chromium, so the SW and Range
fetches behave exactly as they do on the web (unmodified). Tauri uses the OS WebView
(WKWebView on macOS), where service workers, custom schemes and Range are unreliable -
that would risk the one thing that must not break. Tauri wins on binary size (~10MB vs
~150MB), but Electron also makes spawning local processes native, which the local test
re-run already uses (and agent fixes later will). So Electron, unless binary size later
becomes a hard product constraint.

## Layout

Renderers (served by the loopback server):

- Home UI: `home/` - Vue 3 + `@kinora/ui` (the shared design system), Vite build -> `home/dist`.
- Trace viewer: the built `@kinora/trace-viewer` `dist/`, served unmodified.

Both are resolved from the workspace deps in dev and from `resourcesPath/<name>` when packaged.

## Develop

```bash
# from repo root: build the viewer once (the desktop app serves its dist/)
pnpm --filter @kinora/trace-viewer build

cd packages/desktop
pnpm dev                          # build main + home, launch (opens the home window)
pnpm start path/to/trace.zip      # open a specific trace
```

Open a trace three ways: **File > Open Trace…**, **drag-drop** a `.zip`, or pass a
path as an argument / macOS `open-file`.
