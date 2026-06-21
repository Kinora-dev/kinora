import type { Manifest, ProjectEntry, RunReport, TestHistory } from '@kinora/core'

// Dashboard payload types come from the shared contract layer (what the server returns).
export type { Manifest, RunReport, TestHistory }
export type Project = ProjectEntry

export interface SessionUser {
  name: string
  email: string
  image: string | null
}

export interface SessionInfo {
  loggedIn: boolean
  user: SessionUser | null
}

// Exposed on window.kinora in the home renderer (contextBridge). The renderer never
// holds the token or talks to the server directly; everything goes through the main process.
export interface KinoraBridge {
  session: () => Promise<SessionInfo>
  // OAuth device flow: opens the system browser to sign in (github/google/email) + approve.
  loginWithDevice: () => Promise<{ ok: boolean, error?: string }>
  // Notifies the renderer of the user code to display while the device flow is pending.
  onDevicePending: (cb: (info: { userCode: string, verificationUri: string }) => void) => void
  // Abort a pending device flow (user gave up instead of approving in the browser).
  cancelDeviceLogin: () => Promise<void>
  logout: () => Promise<void>
  projects: () => Promise<Project[]>
  run: (input: { projectId: string, runId: string }) => Promise<RunReport>
  // Per-test history for the active project (flaky / newly-broken signal).
  projectHistory: (input: { projectId: string }) => Promise<TestHistory[]>
  openLocalTrace: () => Promise<void>
  // Open a hosted trace.zip (absolute artifact URL) in the embedded viewer.
  openTraceUrl: (traceUrl: string) => Promise<void>
  // Per-project local repo roots (projectId -> absolute path), for open-in-editor / re-run.
  projectPaths: () => Promise<Record<string, string>>
  // Folder-pick a local repo root for a project; returns the chosen path (null if cancelled).
  setProjectPath: (projectId: string) => Promise<string | null>
  // Open a test's source at file:line:column in the editor (needs the project linked).
  openInEditor: (input: { projectId: string, file: string, line: number, column: number }) => Promise<{ ok: boolean, error?: string }>
  // Re-run a single test locally via the repo's playwright (needs the project linked).
  rerunTest: (input: { projectId: string, file: string, line: number, projectName?: string }) => Promise<{ ok: boolean, error?: string }>
  // A re-run launched (user-triggered or by watch mode): reset the panel.
  onRerunStarted: (cb: () => void) => void
  // Live combined stdout/stderr of the running re-run.
  onRerunOutput: (cb: (chunk: string) => void) => void
  // Re-run finished: pass/fail + whether a fresh trace was produced.
  onRerunDone: (cb: (r: { ok: boolean, code: number, hasTrace: boolean }) => void) => void
  // Toggle watch mode: auto re-run the last test when the repo changes.
  setWatch: (enabled: boolean) => Promise<void>
  // Kill the in-flight re-run.
  cancelRerun: () => Promise<void>
  // Open the trace the last re-run produced in the embedded viewer.
  openRerunTrace: () => Promise<void>
  // Open the web account settings in the system browser (account mgmt lives in web).
  openAccount: () => Promise<void>
}

declare global {
  interface Window {
    kinora: KinoraBridge
  }
}
