/* eslint-disable no-console */
import path from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, ipcMain } from 'electron'
import { buildMenu } from './menu'
import { startServer } from './server'

// Probe mode: render headless, capture SW + trace-load state, print a verdict, exit.
// KINORA_DESKTOP_TRACE=<abs.zip> probes the open-a-local-file path; else the demo.
const PROBE = process.env.KINORA_DESKTOP_PROBE === '1'
const PROBE_TRACE = process.env.KINORA_DESKTOP_TRACE || null

let port = 0
let win: BrowserWindow | null = null

// Trace handed in at launch: macOS open-file (file association / `open -a`) is queued
// before the app is ready; other platforms pass the path as an argv.
let pendingOpen: string | null = null
app.on('open-file', (e, p) => {
  e.preventDefault()
  pendingOpen = p
  if (win)
    void loadTrace(p)
})

function argvTrace(): string | null {
  const last = process.argv[process.argv.length - 1]
  return last && last.toLowerCase().endsWith('.zip') ? path.resolve(last) : null
}

// Packaged: the viewer dist is copied into resources (electron-builder extraResources).
// Dev: the built dist of the @kinora/trace-viewer workspace dependency.
function resolveViewerDir(): string {
  if (app.isPackaged)
    return path.join(process.resourcesPath, 'viewer')
  const pkg = require.resolve('@kinora/trace-viewer/package.json')
  return path.join(path.dirname(pkg), 'dist')
}

// Absolute loopback URLs. An absolute ?trace= avoids any base-resolution ambiguity
// in the SW's zip reader; /file streams the local zip with Range.
function viewerUrl(absPath: string | null): string {
  if (!absPath)
    return `http://127.0.0.1:${port}/trace/index.html`
  const inner = `http://127.0.0.1:${port}/file?path=${encodeURIComponent(absPath)}`
  return `http://127.0.0.1:${port}/trace/index.html?trace=${encodeURIComponent(inner)}`
}

function loadTrace(absPath: string | null): Promise<void> | undefined {
  if (!win)
    return
  const url = viewerUrl(absPath)
  console.log(`[desktop] loading ${url}`)
  return win.loadURL(url)
}

interface Verdict {
  swController: boolean
  preloadReady: boolean
  hasErrorBanner: boolean
  stillLoading: boolean
  hasActions: boolean
  bodySample: string
}

async function main(): Promise<void> {
  const started = await startServer(resolveViewerDir())
  port = started.port
  console.log(`[desktop] serving ${started.viewerDir}`)

  win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: !PROBE,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  ipcMain.on('kinora:open-trace', (_e, p: string) => void loadTrace(p))

  buildMenu({
    win,
    onOpen: p => void loadTrace(p),
    onDemo: () => void loadTrace(null),
  })

  win.webContents.on('console-message', (_e, level, message) => {
    console.log(`[renderer:${level}] ${message}`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, validatedURL) => {
    console.error(`[desktop] did-fail-load ${code} ${desc} ${validatedURL}`)
  })

  // Launch trace precedence: probe env > macOS open-file > argv > demo.
  await loadTrace(PROBE_TRACE || pendingOpen || argvTrace())

  if (!PROBE) {
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 6000)
  })
  const verdict = await win.webContents.executeJavaScript(`(() => {
    const text = document.body.innerText || ''
    return {
      swController: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      preloadReady: !!(window.__kinoraDesktop && window.__kinoraDesktop.ready),
      hasErrorBanner: text.includes('Failed to load trace'),
      stillLoading: text.includes('Loading trace'),
      hasActions: text.includes('ACTIONS'),
      bodySample: text.slice(0, 300).replace(/\\s+/g, ' ').trim(),
    }
  })()`) as Verdict

  const ok = verdict.swController && verdict.preloadReady && !verdict.hasErrorBanner && !verdict.stillLoading && verdict.hasActions
  console.log(`[probe] ${JSON.stringify(verdict)}`)
  console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}`)
  app.exit(ok ? 0 : 1)
}

app.whenReady().then(main).catch((err: unknown) => {
  console.error('[desktop] fatal', err)
  app.exit(1)
})

app.on('window-all-closed', () => app.quit())
