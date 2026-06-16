import { Buffer } from 'node:buffer'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app, safeStorage } from 'electron'

export interface Config {
  serverUrl: string
  // better-auth rejects auth requests without a trusted Origin; send the server's web origin.
  webOrigin: string
  token: string | null
}

const DEFAULTS: Config = {
  serverUrl: 'http://localhost:3000',
  webOrigin: 'http://localhost:5173',
  token: null,
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'kinora-desktop.json')
}

export function loadConfig(): Config {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Record<string, string>
    const token = raw.token && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(raw.token, 'base64'))
      : null
    return {
      serverUrl: raw.serverUrl || DEFAULTS.serverUrl,
      webOrigin: raw.webOrigin || DEFAULTS.webOrigin,
      token,
    }
  }
  catch {
    return { ...DEFAULTS }
  }
}

export function saveConfig(config: Config): void {
  const token = config.token && safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(config.token).toString('base64')
    : null
  writeFileSync(configPath(), JSON.stringify({ serverUrl: config.serverUrl, webOrigin: config.webOrigin, token }))
}

export function hasConfigFile(): boolean {
  return existsSync(configPath())
}
