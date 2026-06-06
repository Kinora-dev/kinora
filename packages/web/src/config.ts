// Build-time config from VITE_KINORA_* env (see .env.example / docker build args).
const DEV = import.meta.env.DEV

export const config = {
  // kinora server (tRPC API + better-auth). Empty in prod => same origin.
  serverUrl: import.meta.env.VITE_KINORA_SERVER_URL || (DEV ? 'http://localhost:3000' : ''),
  // Trace viewer: own dev server in dev, served under /trace/ in prod.
  viewerBaseUrl: import.meta.env.VITE_KINORA_VIEWER_URL || (DEV ? 'http://localhost:5174/' : '/trace/'),
}
