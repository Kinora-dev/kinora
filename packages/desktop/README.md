# @kinora/desktop

Desktop app (Electron). Two things in one shell:

- **Local trace viewer** - open any local `trace.zip` (no account, no server). A
  self-contained replacement for `playwright show-trace`.
- **Account dashboard** - sign in to a kinora server and browse your projects
  (more dashboard surface incoming).

## Why Electron

The viewer is the vendored Playwright trace engine: a Vue app plus a service worker that
reads `trace.zip` over HTTP Range. Electron bundles its own Chromium, so the SW and Range
fetches behave exactly as they do on the web (unmodified). Tauri uses the OS WebView
(WKWebView on macOS), where service workers, custom schemes and Range are unreliable -
that would risk the one thing that must not break. Tauri wins on binary size (~10MB vs
~150MB), but Electron also makes spawning local processes native, which later features
(running tests locally, agent fixes) will need. So Electron, unless binary size later
becomes a hard product constraint.

## Why CommonJS

CJS (no `"type": "module"`), unlike the rest of the repo. Electron runs its main process
and a sandboxed preload most reliably as CommonJS; the ESM path would force
`sandbox: false`. The TypeScript source is built to CJS by tsdown.

## Layout

Main process (`src/`, built to CJS by tsdown):

- `main.ts` - Electron entry: loopback server, home + viewer windows, IPC handlers, probes.
- `server.ts` - loopback HTTP: home UI under `/home/`, viewer under `/trace/`, local zip via `/file?path=` (Range/206).
- `config.ts` - server URL + bearer token, persisted with `safeStorage`.
- `account.ts` - email/password sign-in (-> bearer token). `trpc.ts` - typed dashboard client.
- `bridge.ts` - IPC contract types. `home-preload.ts` - exposes it as `window.kinora`. `preload.ts` - viewer drag-drop. `menu.ts` - app menu.

Renderers (served by the loopback server):

- Home UI: `home/` - Vue 3 + `@kinora/ui` (the shared design system), Vite build -> `home/dist`.
- Trace viewer: the built `@kinora/trace-viewer` `dist/`, served unmodified.

Both are resolved from the workspace deps in dev and from `resourcesPath/<name>` when packaged.

## Develop

```bash
# from repo root: build the viewer once (the desktop app serves its dist/)
pnpm --filter @kinora/trace-viewer build

cd packages/desktop
pnpm dev                          # build + launch, demo trace renders
pnpm start path/to/trace.zip      # open a specific trace
pnpm probe                        # headless self-check, exits 0/1
KINORA_DESKTOP_PROBE=1 pnpm exec electron . path/to/trace.zip   # headless open-file check
```

Open a trace three ways: **File > Open Trace…**, **drag-drop** a `.zip`, or pass a
path as an argument / macOS `open-file`.

## Package

```bash
pnpm dist:mac     # dmg + zip into release/ (builds the viewer first)
```

`build` / `typecheck` / `lint` run in root CI (`pnpm -r`); they only compile + check the TS
(fast). Packaging (`dist:mac`, electron-builder) is opt-in and not run by CI.

Not done yet: code signing, notarization, auto-update (electron-updater). Config stubs
are in `electron-builder.yml`.
