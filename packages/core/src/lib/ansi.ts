// Playwright colorizes error messages with ANSI escapes (ESC[..m); strip them for plain display.
const ANSI_RE = new RegExp(`${String.fromCharCode(0x1B)}\\[[0-9;]*[a-z]`, 'gi')

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}
