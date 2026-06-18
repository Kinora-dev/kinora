import type { Fetcher } from '../lib/ssrf'
import type { AlertPayload } from './core'
import { safeFetch } from '../lib/ssrf'
import { listTests } from './core'

export interface SlackPayload {
  text: string
}

export function buildSlackMessage(input: AlertPayload): SlackPayload {
  const { counts } = input
  const ok = counts.unexpected === 0
  const lines = [
    `${ok ? '✅' : '🔴'} *${input.projectName}* run finished`,
    `${counts.expected} passed · ${counts.unexpected} failed · ${counts.flaky} flaky · ${counts.skipped} skipped`,
  ]
  if (input.newlyFailing.length)
    lines.push(`*Newly failing (${input.newlyFailing.length}):* ${listTests(input.newlyFailing)}`)
  if (input.newlyFlaky.length)
    lines.push(`*Newly flaky (${input.newlyFlaky.length}):* ${listTests(input.newlyFlaky)}`)
  lines.push(`<${input.runUrl}|View run>`)
  return { text: lines.join('\n') }
}

export async function sendSlack(
  webhookUrl: string,
  payload: SlackPayload,
  fetchImpl: Fetcher = safeFetch,
): Promise<void> {
  const res = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok)
    throw new Error(`slack webhook responded ${res.status}`)
}
