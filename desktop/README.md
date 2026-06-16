# @kinora/desktop

Desktop app (Electron) that opens local Playwright `trace.zip` files in the kinora
trace viewer, with no account and no kinora server. A self-contained replacement for
`playwright show-trace`.

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

- `src/main.ts` - Electron entry: loopback server, window, launch/open routing, headless probe.
- `src/server.ts` - loopback HTTP: viewer static under `/trace/`, local zip via `/file?path=` (Range/206).
- `src/menu.ts` - app menu, **File > Open Trace…** (Cmd+O).
- `src/preload.ts` - drag-drop a `.zip` -> IPC -> open.

The renderer is the built `@kinora/trace-viewer` `dist/`, served unmodified. Resolved by
relative path (`../packages/trace-viewer/dist`) in dev, and from `resourcesPath/viewer`
when packaged.

## Develop

```bash
# from repo root: build the viewer once (the desktop app serves its dist/)
pnpm --filter @kinora/trace-viewer build

cd desktop
pnpm install                      # own workspace, own lockfile
pnpm dev                          # build + launch, demo trace renders
pnpm start path/to/trace.zip      # open a specific trace
pnpm probe                        # headless self-check, exits 0/1
KINORA_DESKTOP_PROBE=1 electron . path/to/trace.zip   # headless open-file check
```

Open a trace three ways: **File > Open Trace…**, **drag-drop** a `.zip`, or pass a
path as an argument / macOS `open-file`.

## Package

```bash
pnpm dist:mac     # dmg + zip into release/ (builds the viewer from the root workspace first)
```

`pnpm build` / `pnpm typecheck` only compile + check the TS (fast), and packaging
(`dist:mac`) is opt-in. This workspace is not in the root `pnpm -r` build/typecheck, so
it has no effect on root CI there; root `eslint .` does still lint `desktop/src`.

Not done yet: code signing, notarization, auto-update (electron-updater). Config stubs
are in `electron-builder.yml`.
