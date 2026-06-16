import type { KinoraBridge } from './bridge'
import { contextBridge, ipcRenderer } from 'electron'

// The home renderer talks to the main process through this bridge only. The token and
// the server live in main; the renderer never sees them.
const bridge: KinoraBridge = {
  session: () => ipcRenderer.invoke('kinora:session'),
  login: input => ipcRenderer.invoke('kinora:login', input),
  logout: () => ipcRenderer.invoke('kinora:logout'),
  projects: () => ipcRenderer.invoke('kinora:projects'),
  openLocalTrace: () => ipcRenderer.invoke('kinora:open-local-trace'),
}

contextBridge.exposeInMainWorld('kinora', bridge)
