// Headless proof of the desktop auth path: email/pwd sign-in -> bearer session
// token (set-auth-token header) -> authenticated tRPC call. No Electron, no cookie.
// Run against a running server: node scripts/login-probe.mjs
import process from 'node:process'

const server = process.env.KINORA_SERVER || 'http://localhost:3000'
const email = process.env.KINORA_EMAIL || 'demo@kinora.dev'
const password = process.env.KINORA_PASSWORD || 'password123'
// better-auth rejects auth requests without a trusted Origin (CSRF guard).
const origin = process.env.KINORA_WEB_ORIGIN || 'http://localhost:5173'

const signin = await fetch(`${server}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'Origin': origin },
  body: JSON.stringify({ email, password }),
})
const token = signin.headers.get('set-auth-token')
console.log(`[probe] sign-in ${signin.status} token=${token ? 'yes' : 'no'}`)
if (!token) {
  console.log(await signin.text())
  process.exit(1)
}

// tRPC query over GET (no batch), authed with the bearer token.
const res = await fetch(`${server}/trpc/dashboard.manifest`, {
  headers: { Authorization: `Bearer ${token}` },
})
const body = await res.json()
const projects = body?.result?.data?.projects
console.log(`[probe] manifest ${res.status} projects=${Array.isArray(projects) ? projects.length : JSON.stringify(body).slice(0, 200)}`)
process.exit(res.ok && Array.isArray(projects) ? 0 : 1)
