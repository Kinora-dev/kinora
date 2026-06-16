// Email/password sign-in against better-auth. The bearer plugin returns the session
// token in the set-auth-token header; that token is what we store and send as Bearer.
export async function signIn(serverUrl: string, webOrigin: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${serverUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    // Origin is required by better-auth's CSRF guard; send the server's trusted web origin.
    headers: { 'Content-Type': 'application/json', 'Origin': webOrigin },
    body: JSON.stringify({ email, password }),
  })
  const token = res.headers.get('set-auth-token')
  if (!res.ok || !token) {
    const body = await res.text().catch(() => '')
    let message = `Sign in failed (${res.status})`
    try {
      const parsed = JSON.parse(body) as { message?: string }
      if (parsed.message)
        message = parsed.message
    }
    catch {}
    throw new Error(message)
  }
  return token
}
