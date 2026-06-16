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
  compareRuns: input => ipcRenderer.invoke('kinora:compare-runs', input),
  openLocalTrace: () => ipcRenderer.invoke('kinora:open-local-trace'),
  openTraceUrl: traceUrl => ipcRenderer.invoke('kinora:open-trace-url', traceUrl),
  projectPaths: () => ipcRenderer.invoke('kinora:project-paths'),
  setProjectPath: projectId => ipcRenderer.invoke('kinora:set-project-path', projectId),
  openInEditor: input => ipcRenderer.invoke('kinora:open-in-editor', input),
  openAccount: () => ipcRenderer.invoke('kinora:open-account'),
}

contextBridge.exposeInMainWorld('kinora', bridge)
