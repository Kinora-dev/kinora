/* eslint-disable no-console */
import path from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { signIn } from './account'
import { loadConfig, saveConfig } from './config'
import { pollDeviceToken, requestDeviceCode } from './device'
import { buildMenu } from './menu'
import { startServer } from './server'
import { makeTrpc } from './trpc'

// Probes: render headless, assert, exit. VIEWER checks a local trace renders;
// HOME logs in with env creds and checks the project list renders.
const VIEWER_PROBE = process.env.KINORA_DESKTOP_PROBE === '1'
const HOME_PROBE = process.env.KINORA_HOME_PROBE === '1'
const DEVICE_PROBE = process.env.KINORA_DEVICE_PROBE === '1'
const PROBE_TRACE = process.env.KINORA_DESKTOP_TRACE || null

let port = 0
let homeWin: BrowserWindow | null = null
let viewerWin: BrowserWindow | null = null
let config = loadConfig()
// Aborts the in-flight device-flow poll when the user cancels.
let deviceAbort: AbortController | null = null

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

function ensureViewerWindow(): BrowserWindow {
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
  return viewerWin
}

function loadViewer(traceParam: string | null): void {
  const base = `http://127.0.0.1:${port}/trace/index.html`
  const url = traceParam ? `${base}?trace=${encodeURIComponent(traceParam)}` : base
  void ensureViewerWindow().loadURL(url)
}

// Local file: served through the loopback /file route.
function openViewer(absPath: string | null): void {
  loadViewer(absPath ? `http://127.0.0.1:${port}/file?path=${encodeURIComponent(absPath)}` : null)
}

// Hosted artifact: the absolute URL is passed straight to the viewer's zip reader.
function openViewerUrl(traceUrl: string): void {
  loadViewer(traceUrl)
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
  ipcMain.handle('kinora:session', async () => {
    if (!config.token)
      return { loggedIn: false, user: null }
    try {
      const me = await makeTrpc(config.serverUrl, config.token, config.webOrigin).user.me.query()
      if (!me)
        return { loggedIn: false, user: null }
      return { loggedIn: true, user: { name: me.name, email: me.email, image: me.image ?? null } }
    }
    catch {
      return { loggedIn: false, user: null }
    }
  })

  ipcMain.handle('kinora:open-account', () => shell.openExternal(`${config.webOrigin}/settings/account`))

  // Device flow: open the system browser to approve (no embedded webview, so all providers
  // work), then poll for the access token. The user code is surfaced to the renderer.
  ipcMain.handle('kinora:login-device', async () => {
    const abort = new AbortController()
    deviceAbort = abort
    try {
      const code = await requestDeviceCode(config.serverUrl)
      homeWin?.webContents.send('kinora:device-pending', { userCode: code.user_code, verificationUri: code.verification_uri })
      await shell.openExternal(code.verification_uri_complete)
      const token = await pollDeviceToken(config.serverUrl, code.device_code, code.interval ?? 5, abort.signal)
      if (abort.signal.aborted)
        return { ok: false, error: 'cancelled' }
      if (!token)
        return { ok: false, error: 'Device authorization failed or timed out' }
      config = { ...config, token }
      saveConfig(config)
      return { ok: true }
    }
    catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Device login failed' }
    }
    finally {
      if (deviceAbort === abort)
        deviceAbort = null
    }
  })

  ipcMain.handle('kinora:cancel-device-login', () => deviceAbort?.abort())

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

  ipcMain.handle('kinora:run', async (_e, input: { projectId: string, runId: string }) => {
    if (!config.token)
      throw new Error('Not signed in')
    const trpc = makeTrpc(config.serverUrl, config.token, config.webOrigin)
    return trpc.dashboard.run.query(input)
  })

  ipcMain.handle('kinora:project-history', async (_e, input: { projectId: string }) => {
    if (!config.token)
      return []
    const trpc = makeTrpc(config.serverUrl, config.token, config.webOrigin)
    const history = await trpc.dashboard.projectHistory.query(input)
    return history.histories
  })

  ipcMain.handle('kinora:compare-runs', async (_e, input: { projectId: string, baseRunId: string, headRunId: string }) => {
    if (!config.token)
      throw new Error('Not signed in')
    const trpc = makeTrpc(config.serverUrl, config.token, config.webOrigin)
    return trpc.dashboard.compareRuns.query(input)
  })

  ipcMain.handle('kinora:open-trace-url', (_e, traceUrl: string) => openViewerUrl(traceUrl))

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

  // Device-flow probe: request a code, simulate the browser approval (sign in + approve),
  // then poll for the access token. Validates the full server-side device grant headless.
  if (DEVICE_PROBE) {
    config = { ...config, serverUrl: process.env.KINORA_SERVER || config.serverUrl, webOrigin: process.env.KINORA_WEB_ORIGIN || config.webOrigin }
    const ok = await probeDevice()
    console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}`)
    app.exit(ok ? 0 : 1)
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
    const text = document.body.innerText || ''
    return { failuresView: text.includes('latest run'), body: text.slice(0, 160).replace(/\\s+/g, ' ').trim() }
  })()`) as { failuresView: boolean, body: string }
  if (process.env.KINORA_SHOT) {
    if (process.env.KINORA_SHOT_PROJECT) {
      await homeWin!.webContents.executeJavaScript(`localStorage.setItem('kinora-desktop-project', ${JSON.stringify(process.env.KINORA_SHOT_PROJECT)})`)
      await homeWin!.webContents.reload()
      await new Promise<void>(resolve => setTimeout(resolve, 4000))
    }
    if (process.env.KINORA_SHOT_FILTER) {
      await homeWin!.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(process.env.KINORA_SHOT_FILTER)})?.click()`)
      await new Promise<void>(resolve => setTimeout(resolve, 600))
    }
    const img = await homeWin!.webContents.capturePage()
    const { writeFileSync } = await import('node:fs')
    writeFileSync(process.env.KINORA_SHOT, img.toPNG())
  }
  const ok = v.failuresView
  console.log(`[probe] home ${JSON.stringify(v)}`)
  console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}`)
  app.exit(ok ? 0 : 1)
}

async function probeDevice(): Promise<boolean> {
  const code = await requestDeviceCode(config.serverUrl)
  console.log(`[probe] device/code user_code=${code.user_code}`)
  // Simulate the browser approval: sign in for a session token, then approve the user code.
  const token = await signIn(config.serverUrl, config.webOrigin, process.env.KINORA_EMAIL || 'demo@kinora.dev', process.env.KINORA_PASSWORD || 'password123')
  const approve = await fetch(`${config.serverUrl}/api/auth/device/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Origin': config.webOrigin },
    body: JSON.stringify({ userCode: code.user_code }),
  })
  console.log(`[probe] device/approve status=${approve.status}`)
  const accessToken = await pollDeviceToken(config.serverUrl, code.device_code, 1)
  console.log(`[probe] device access_token=${accessToken ? 'yes' : 'no'}`)
  return !!accessToken
}

app.whenReady().then(main).catch((err: unknown) => {
  console.error('[desktop] fatal', err)
  app.exit(1)
})

app.on('window-all-closed', () => app.quit())
