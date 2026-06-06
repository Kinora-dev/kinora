import { env } from '@/lib/env'

interface AttachmentLike {
  name: string
  contentType: string
  url?: string
}

// Link to open a test's trace in the bundled trace viewer, or undefined if the
// test has no hosted trace. The server returns an absolute artifact URL.
export function traceViewerHref(attachments: AttachmentLike[]): string | undefined {
  const trace = attachments.find(a => a.url && (a.name === 'trace' || a.contentType === 'application/zip'))
  if (!trace?.url)
    return undefined
  const viewer = env.viewerBaseUrl.endsWith('/') ? env.viewerBaseUrl : `${env.viewerBaseUrl}/`
  return `${viewer}?trace=${encodeURIComponent(trace.url)}`
}
