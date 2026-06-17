import { spawn } from 'node:child_process'
import process from 'node:process'

// GUI-launched apps inherit a stripped PATH, so spawned CLIs (editor, playwright,
// node) often aren't found; include the usual install dirs.
const EXTRA_PATH = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin']
// `code` and its forks (cursor, codium, code-insiders) all accept `--goto file:line:col`.
const BIN = process.env.KINORA_EDITOR_CMD || 'code'

export function augmentedPath(): string {
  return [process.env.PATH, ...EXTRA_PATH].filter(Boolean).join(':')
}

// Open an absolute file at line:column in the editor. Rejects if the CLI isn't installed
// so the renderer can surface a hint.
export function openInEditor(absFile: string, line: number, column: number): Promise<void> {
  const target = `${absFile}:${line}:${column}`
  const env = { ...process.env, PATH: augmentedPath() }
  return new Promise((resolve, reject) => {
    const child = spawn(BIN, ['--goto', target], { env, stdio: 'ignore' })
    child.on('error', () => reject(new Error(`Editor CLI (\`${BIN}\`) not found`)))
    child.on('spawn', () => resolve())
  })
}
