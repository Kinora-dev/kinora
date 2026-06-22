// Both ingest paths read the FINAL attempt's attachments, but Playwright's common
// `trace: 'on-first-retry'` records the trace on an EARLIER attempt - so a failing test
// (which retries to a traceless final attempt) would lose its trace. Surface the most
// recent trace from any attempt when the final attempt has none.

interface RawAttachment {
  name: string
  contentType: string
  path?: string
}

function isTraceLike(a: RawAttachment): boolean {
  return a.name === 'trace' || a.contentType === 'application/zip' || (a.path?.endsWith('.zip') ?? false)
}

export function effectiveAttachments<A extends RawAttachment>(
  results: ReadonlyArray<{ attachments?: A[] }>,
): A[] {
  const last = results.at(-1)?.attachments ?? []
  if (last.some(isTraceLike))
    return last
  const trace = results.flatMap(r => r.attachments ?? []).filter(isTraceLike).at(-1)
  return trace ? [...last, trace] : last
}
