// OAuth 2.0 Device Authorization Grant client (better-auth deviceAuthorization plugin).
const CLIENT_ID = 'kinora-desktop'
const GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

export interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  interval?: number
  expires_in?: number
}

export async function requestDeviceCode(serverUrl: string): Promise<DeviceCode> {
  const res = await fetch(`${serverUrl}/api/auth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'openid profile email' }),
  })
  if (!res.ok)
    throw new Error(`device/code failed (${res.status})`)
  return res.json() as Promise<DeviceCode>
}

// Poll until the user approves (access_token), a terminal error/timeout, or `signal` aborts.
// Returns the bearer token, or null (cancelled/timed out/denied).
export async function pollDeviceToken(serverUrl: string, deviceCode: string, intervalSec: number, signal?: AbortSignal): Promise<string | null> {
  let interval = Math.max(1, intervalSec)
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    if (signal?.aborted)
      return null
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, interval * 1000)
      signal?.addEventListener('abort', () => {
        clearTimeout(t)
        resolve()
      }, { once: true })
    })
    if (signal?.aborted)
      return null
    const res = await fetch(`${serverUrl}/api/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: GRANT, device_code: deviceCode, client_id: CLIENT_ID }),
    })
    const data = await res.json() as { access_token?: string, error?: string }
    if (data.access_token)
      return data.access_token
    if (data.error === 'slow_down')
      interval += 5
    else if (data.error && data.error !== 'authorization_pending')
      return null
  }
  return null
}
