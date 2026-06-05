export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms))
    return ''
  if (ms < 1000)
    return `${Math.round(ms)}ms`
  if (ms < 60_000)
    return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m${s.toString().padStart(2, '0')}s`
}
