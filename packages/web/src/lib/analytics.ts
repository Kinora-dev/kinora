// Loads only in cloud builds, self-host builds never send events.
const UMAMI_SRC = 'https://analytics.jorisgallot.dev/j.js'
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

export function initAnalytics(): void {
  if (!import.meta.env.PROD || !websiteId)
    return
  const s = document.createElement('script')
  s.defer = true
  s.src = UMAMI_SRC
  s.dataset.websiteId = websiteId
  document.head.appendChild(s)
}

export function track(event: string, data?: Record<string, unknown>): void {
  window.umami?.track(event, data)
}
