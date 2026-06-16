/* eslint-disable no-console */
import type { LoginInput } from './bridge'
import path from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { signIn } from './account'
import { loadConfig, saveConfig } from './config'
import { buildMenu } from './menu'
import { startServer } from './server'
import { makeTrpc } from './trpc'

// Probes: render headless, assert, exit. VIEWER checks a local trace renders;
// HOME logs in with env creds and checks the project list renders.
const VIEWER_PROBE = process.env.KINORA_DESKTOP_PROBE === '1'
const HOME_PROBE = process.env.KINORA_HOME_PROBE === '1'
const PROBE_TRACE = process.env.KINORA_DESKTOP_TRACE || null

let port = 0
let homeWin: BrowserWindow | null = null
let viewerWin: BrowserWindow | null = null
let config = loadConfig()

// macOS open-file (file association) and argv both hand us a local trace to view.
let pendingOpen: string | null = null
app.on('open-file', (e, p) => {
  e.preventDefault()
  pendingOpen = p
  openViewer(p)
})

function argvTrace(): string | null {
  const last = process.argv[process.argv.length - 1]
  return last && last.toLowerCase().endsWith('.zip') ? path.resolve(last) : null
}

// Packaged: dirs copied into resources. Dev: workspace dep dist + the local Vite build.
function resolveViewerDir(): string {
  if (app.isPackaged)
    return path.join(process.resourcesPath, 'viewer')
  const pkg = require.resolve('@kinora/trace-viewer/package.json')
  return path.join(path.dirname(pkg), 'dist')
}
function resolveHomeDir(): string {
  if (app.isPackaged)
    return path.join(process.resourcesPath, 'home')
  return path.join(__dirname, '../home/dist')
}

function viewerUrl(absPath: string | null): string {
  if (!absPath)
    return `http://127.0.0.1:${port}/trace/index.html`
  const inner = `http://127.0.0.1:${port}/file?path=${encodeURIComponent(absPath)}`
  return `http://127.0.0.1:${port}/trace/index.html?trace=${encodeURIComponent(inner)}`
}

function openViewer(absPath: string | null): void {
  const url = viewerUrl(absPath)
  if (!viewerWin || viewerWin.isDestroyed()) {
    viewerWin = new BrowserWindow({
      width: 1280,
      height: 860,
      show: !VIEWER_PROBE,
      webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
    })
    viewerWin.webContents.on('console-message', (_e, level, message) => console.log(`[viewer:${level}] ${message}`))
    viewerWin.on('closed', () => {
      viewerWin = null
    })
  }
  else {
    viewerWin.focus()
  }
  void viewerWin.loadURL(url)
}

function createHomeWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    show: !HOME_PROBE,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'home-preload.cjs') },
  })
  win.webContents.on('console-message', (_e, level, message) => console.log(`[home:${level}] ${message}`))
  void win.loadURL(`http://127.0.0.1:${port}/home/index.html`)
  return win
}

function registerIpc(): void {
  ipcMain.handle('kinora:session', () => ({ loggedIn: !!config.token, serverUrl: config.serverUrl }))

  ipcMain.handle('kinora:login', async (_e, input: LoginInput) => {
    try {
      const token = await signIn(input.serverUrl, config.webOrigin, input.email, input.password)
      config = { ...config, serverUrl: input.serverUrl, token }
      saveConfig(config)
      return { ok: true }
    }
    catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Sign in failed' }
    }
  })

  ipcMain.handle('kinora:logout', () => {
    config = { ...config, token: null }
    saveConfig(config)
  })

  ipcMain.handle('kinora:projects', async () => {
    if (!config.token)
      return []
    const trpc = makeTrpc(config.serverUrl, config.token, config.webOrigin)
    const manifest = await trpc.dashboard.manifest.query()
    return manifest.projects
  })

  ipcMain.handle('kinora:open-local-trace', async () => {
    const res = await dialog.showOpenDialog(homeWin ?? undefined as never, {
      title: 'Open Playwright trace',
      properties: ['openFile'],
      filters: [{ name: 'Playwright trace', extensions: ['zip'] }],
    })
    if (!res.canceled && res.filePaths[0])
      openViewer(res.filePaths[0])
  })
}

async function main(): Promise<void> {
  const started = await startServer({ viewerDir: resolveViewerDir(), homeDir: resolveHomeDir() })
  port = started.port
  registerIpc()

  // Viewer probe: open a trace window and assert it renders.
  if (VIEWER_PROBE) {
    openViewer(PROBE_TRACE || pendingOpen || argvTrace())
    await probeViewer()
    return
  }

  // Home probe: log in with env creds, then assert the project list renders.
  if (HOME_PROBE) {
    config = { ...config, serverUrl: process.env.KINORA_SERVER || config.serverUrl, webOrigin: process.env.KINORA_WEB_ORIGIN || config.webOrigin }
    const token = await signIn(config.serverUrl, config.webOrigin, process.env.KINORA_EMAIL || 'demo@kinora.dev', process.env.KINORA_PASSWORD || 'password123')
    config = { ...config, token }
    homeWin = createHomeWindow()
    await probeHome()
    return
  }

  homeWin = createHomeWindow()
  homeWin.on('closed', () => {
    homeWin = null
  })
  buildMenu({ win: homeWin, onOpen: openViewer, onDemo: () => openViewer(null) })

  // A trace passed at launch opens straight in the viewer.
  const launchTrace = pendingOpen || argvTrace()
  if (launchTrace)
    openViewer(launchTrace)
}

async function probeViewer(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 6000)
  })
  const v = await viewerWin!.webContents.executeJavaScript(`(() => {
    const text = document.body.innerText || ''
    return { sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), err: text.includes('Failed to load trace'), actions: text.includes('ACTIONS') }
  })()`) as { sw: boolean, err: boolean, actions: boolean }
  const ok = v.sw && !v.err && v.actions
  console.log(`[probe] viewer ${JSON.stringify(v)}`)
  console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}`)
  app.exit(ok ? 0 : 1)
}

async function probeHome(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 5000)
  })
  const v = await homeWin!.webContents.executeJavaScript(`(() => {
    return { projects: document.querySelectorAll('[data-project]').length, body: (document.body.innerText || '').slice(0, 160).replace(/\\s+/g, ' ').trim() }
  })()`) as { projects: number, body: string }
  const ok = v.projects > 0
  console.log(`[probe] home ${JSON.stringify(v)}`)
  console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}`)
  app.exit(ok ? 0 : 1)
}

app.whenReady().then(main).catch((err: unknown) => {
  console.error('[desktop] fatal', err)
  app.exit(1)
})

app.on('window-all-closed', () => app.quit())
