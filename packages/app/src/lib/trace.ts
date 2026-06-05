import { config } from '@/config'

interface AttachmentLike {
  name: string
  contentType: string
  url?: string
}

// Absolute URL to a hosted artifact, resolved against the data base url.
function artifactUrl(relative: string): string {
  const base = config.baseUrl.replace(/\/$/, '')
  const dataRoot = base ? new URL(`${base}/`, location.href).href : `${location.origin}/`
  return new URL(relative, dataRoot).href
}

// Link to open a test's trace in the bundled trace viewer, or undefined if the
// test has no hosted trace.
export function traceViewerHref(attachments: AttachmentLike[]): string | undefined {
  const trace = attachments.find(a => a.url && (a.name === 'trace' || a.contentType === 'application/zip'))
  if (!trace?.url)
    return undefined
  const viewer = config.viewerBaseUrl.endsWith('/') ? config.viewerBaseUrl : `${config.viewerBaseUrl}/`
  return `${viewer}?trace=${encodeURIComponent(artifactUrl(trace.url))}`
}
