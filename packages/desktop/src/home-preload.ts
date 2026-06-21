import type { KinoraBridge } from './bridge'
import { contextBridge, ipcRenderer } from 'electron'
// The home renderer talks to the main process through this bridge only. The token and
// the server live in main; the renderer never sees them.
const bridge: KinoraBridge = {
  session: () => ipcRenderer.invoke('kinora:session'),
  loginWithDevice: () => ipcRenderer.invoke('kinora:login-device'),
  onDevicePending: cb => ipcRenderer.on('kinora:device-pending', (_e, info) => cb(info)),
  cancelDeviceLogin: () => ipcRenderer.invoke('kinora:cancel-device-login'),
  logout: () => ipcRenderer.invoke('kinora:logout'),
  projects: () => ipcRenderer.invoke('kinora:projects'),
  run: input => ipcRenderer.invoke('kinora:run', input),
  projectHistory: input => ipcRenderer.invoke('kinora:project-history', input),
  openLocalTrace: () => ipcRenderer.invoke('kinora:open-local-trace'),
  openTraceUrl: traceUrl => ipcRenderer.invoke('kinora:open-trace-url', traceUrl),
  projectPaths: () => ipcRenderer.invoke('kinora:project-paths'),
  setProjectPath: projectId => ipcRenderer.invoke('kinora:set-project-path', projectId),
  openInEditor: input => ipcRenderer.invoke('kinora:open-in-editor', input),
  rerunTest: input => ipcRenderer.invoke('kinora:rerun-test', input),
  onRerunStarted: cb => ipcRenderer.on('kinora:rerun-started', () => cb()),
  onRerunOutput: cb => ipcRenderer.on('kinora:rerun-output', (_e, chunk) => cb(chunk)),
  onRerunDone: cb => ipcRenderer.on('kinora:rerun-done', (_e, r) => cb(r)),
  setWatch: enabled => ipcRenderer.invoke('kinora:set-watch', enabled),
  cancelRerun: () => ipcRenderer.invoke('kinora:cancel-rerun'),
  openRerunTrace: () => ipcRenderer.invoke('kinora:open-rerun-trace'),
  openAccount: () => ipcRenderer.invoke('kinora:open-account'),
  onUpdateReady: cb => ipcRenderer.on('kinora:update-ready', () => cb()),
  restartToUpdate: () => ipcRenderer.invoke('kinora:restart-to-update'),
  isDev: process.argv.includes('--kinora-dev=1'),
  platform: process.platform,
}

contextBridge.exposeInMainWorld('kinora', bridge)
