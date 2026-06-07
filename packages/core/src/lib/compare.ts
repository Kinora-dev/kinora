import type { NormTest, TestChange, TestDelta } from '../contracts/kinora'

function classify(base: NormTest | undefined, head: NormTest | undefined): TestChange {
  if (!base)
    return 'added'
  if (!head)
    return 'removed'
  if (base.status === head.status)
    return base.status === 'unexpected' ? 'still-failing' : 'unchanged'
  if (head.status === 'unexpected')
    return 'broken'
  if (base.status === 'unexpected')
    return 'fixed'
  if (head.status === 'flaky')
    return 'newly-flaky'
  return 'unchanged'
}

// Diff two runs by testKey (the cross-run identity). Pure: order-independent.
export function compareRuns(base: NormTest[], head: NormTest[]): TestDelta[] {
  const baseByKey = new Map(base.map(t => [t.testKey, t]))
  const headByKey = new Map(head.map(t => [t.testKey, t]))
  const keys = new Set([...baseByKey.keys(), ...headByKey.keys()])

  const deltas: TestDelta[] = []
  for (const key of keys) {
    const b = baseByKey.get(key)
    const h = headByKey.get(key)
    const ref = h ?? b
    if (!ref)
      continue
    deltas.push({
      testKey: key,
      title: ref.title,
      titlePath: ref.titlePath,
      file: ref.file,
      projectName: ref.projectName,
      change: classify(b, h),
      baseStatus: b?.status ?? null,
      headStatus: h?.status ?? null,
      durationDelta: (h?.duration ?? 0) - (b?.duration ?? 0),
    })
  }
  return deltas
}
