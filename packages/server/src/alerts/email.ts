import type { AlertPayload } from './core'
import { listTests } from './core'

export function buildAlertEmail(p: AlertPayload): { subject: string, text: string } {
  const { counts } = p
  const subject = `${counts.unexpected > 0 ? '🔴' : '✅'} ${p.projectName}: ${counts.unexpected} failed, ${counts.flaky} flaky`
  const lines = [
    `${p.projectName} run finished.`,
    '',
    `${counts.expected} passed · ${counts.unexpected} failed · ${counts.flaky} flaky · ${counts.skipped} skipped`,
  ]
  if (p.newlyFailing.length)
    lines.push('', `Newly failing (${p.newlyFailing.length}): ${listTests(p.newlyFailing)}`)
  if (p.newlyFlaky.length)
    lines.push('', `Newly flaky (${p.newlyFlaky.length}): ${listTests(p.newlyFlaky)}`)
  lines.push('', `View the run: ${p.runUrl}`)
  return { subject, text: lines.join('\n') }
}
