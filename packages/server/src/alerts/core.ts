import type { Counts } from '@kinora/core'

export type AlertPolicy = 'always' | 'on-failure' | 'on-regression'

// Channel-neutral alert data, built once per run and formatted per delivery channel.
export interface AlertPayload {
  projectName: string
  runUrl: string
  counts: Counts
  newlyFailing: string[]
  newlyFlaky: string[]
}

export function shouldFire(policy: AlertPolicy, counts: Counts, newlyFailing: number, newlyFlaky: number): boolean {
  return policy === 'always'
    || (policy === 'on-failure' && counts.unexpected > 0)
    || (policy === 'on-regression' && (newlyFailing > 0 || newlyFlaky > 0))
}

const MAX_LISTED = 10

export function listTests(titles: string[]): string {
  const rest = titles.length - MAX_LISTED
  return titles.slice(0, MAX_LISTED).join(', ') + (rest > 0 ? ` and ${rest} more` : '')
}
