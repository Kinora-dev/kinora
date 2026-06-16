import type { Manifest, ProjectEntry, RunComparison, RunReport, TestHistory } from '@kinora/core'

// Dashboard payload types come from the shared contract layer (what the server returns).
export type { Manifest, RunComparison, RunReport, TestHistory }
export type Project = ProjectEntry

export interface SessionInfo {
  loggedIn: boolean
  serverUrl: string
}

// Exposed on window.kinora in the home renderer (contextBridge). The renderer never
// holds the token or talks to the server directly; everything goes through the main process.
export interface KinoraBridge {
  session: () => Promise<SessionInfo>
  // OAuth device flow: opens the system browser to sign in (github/google/email) + approve.
  loginWithDevice: () => Promise<{ ok: boolean, error?: string }>
  // Notifies the renderer of the user code to display while the device flow is pending.
  onDevicePending: (cb: (info: { userCode: string, verificationUri: string }) => void) => void
  logout: () => Promise<void>
  projects: () => Promise<Project[]>
  run: (input: { projectId: string, runId: string }) => Promise<RunReport>
  // Per-test history for the active project (flaky / newly-broken signal).
  projectHistory: (input: { projectId: string }) => Promise<TestHistory[]>
  // Diff two runs (used for "what broke since the last green run").
  compareRuns: (input: { projectId: string, baseRunId: string, headRunId: string }) => Promise<RunComparison>
  openLocalTrace: () => Promise<void>
  // Open a hosted trace.zip (absolute artifact URL) in the embedded viewer.
  openTraceUrl: (traceUrl: string) => Promise<void>
}

declare global {
  interface Window {
    kinora: KinoraBridge
  }
}
