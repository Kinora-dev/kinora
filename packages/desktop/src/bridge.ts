import type { Manifest, ProjectEntry } from '@kinora/core'

// Dashboard payload types come from the shared contract layer (what the server returns).
export type { Manifest }
export type Project = ProjectEntry

export interface SessionInfo {
  loggedIn: boolean
  serverUrl: string
}

export interface LoginInput {
  serverUrl: string
  email: string
  password: string
}

// Exposed on window.kinora in the home renderer (contextBridge). The renderer never
// holds the token or talks to the server directly; everything goes through the main process.
export interface KinoraBridge {
  session: () => Promise<SessionInfo>
  login: (input: LoginInput) => Promise<{ ok: boolean, error?: string }>
  logout: () => Promise<void>
  projects: () => Promise<Project[]>
  openLocalTrace: () => Promise<void>
}

declare global {
  interface Window {
    kinora: KinoraBridge
  }
}
