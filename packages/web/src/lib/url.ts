// Return the URL only if it is https (the only scheme we link out to); blocks javascript:/data:/http
// in href bindings (stored XSS + transport downgrade).
export function httpsUrl(url: string | undefined | null): string | undefined {
  if (!url)
    return undefined
  try {
    return new URL(url).protocol === 'https:' ? url : undefined
  }
  catch {
    return undefined
  }
}
