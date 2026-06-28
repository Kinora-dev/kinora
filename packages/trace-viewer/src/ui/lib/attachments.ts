import type { Attachment } from '@isomorphic/trace/traceModel'

export interface ImageDiffGroup {
  name: string
  expected?: Attachment
  actual?: Attachment
  diff?: Attachment
}

const DIFF_RE = /^(.*)-(expected|actual|diff)\.png$/

// Groups Playwright's `<name>-{expected,actual,diff}.png` screenshot triplets;
// incomplete groups (missing expected or actual) stay in `rest` as plain attachments.
export function groupImageDiffs(attachments: Attachment[]): { diffs: ImageDiffGroup[], rest: Attachment[] } {
  const groups = new Map<string, ImageDiffGroup>()
  const order: string[] = []
  for (const att of attachments) {
    const m = att.name.match(DIFF_RE)
    if (!m)
      continue
    const [, name, type] = m
    let g = groups.get(name)
    if (!g) {
      g = { name }
      groups.set(name, g)
      order.push(name)
    }
    g[type as 'expected' | 'actual' | 'diff'] = att
  }

  const diffs: ImageDiffGroup[] = []
  const used = new Set<Attachment>()
  for (const name of order) {
    const g = groups.get(name)!
    if (!g.expected || !g.actual)
      continue
    diffs.push(g)
    used.add(g.expected).add(g.actual)
    if (g.diff)
      used.add(g.diff)
  }

  return { diffs, rest: attachments.filter(a => !used.has(a)) }
}
