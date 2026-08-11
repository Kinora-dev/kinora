import { env } from '@/lib/env'

interface AttachmentLike {
  name: string
  contentType: string
  url?: string
}

export function isTraceAttachment(a: AttachmentLike): boolean {
  return a.name === 'trace' || a.contentType === 'application/zip'
}

// Link to open a test's trace in the bundled trace viewer, or undefined if the
// test has no hosted trace. The server returns an absolute artifact URL.
export function traceViewerHref(attachments: AttachmentLike[], tab?: 'attachments'): string | undefined {
  const trace = attachments.find(a => a.url && isTraceAttachment(a))
  if (!trace?.url)
    return undefined
  const viewer = env.viewerBaseUrl.endsWith('/') ? env.viewerBaseUrl : `${env.viewerBaseUrl}/`
  const href = `${viewer}?trace=${encodeURIComponent(trace.url)}`
  return tab ? `${href}&tab=${tab}` : href
}
