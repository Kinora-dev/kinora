import type { Counts } from '@kinora/core'

export interface SlackPayload {
  text: string
}

export interface SlackAlertInput {
  projectName: string
  runUrl: string
  counts: Counts
  newlyFailing: string[]
  newlyFlaky: string[]
}

const MAX_LISTED = 10

export function buildSlackMessage(input: SlackAlertInput): SlackPayload {
  const { counts } = input
  const ok = counts.unexpected === 0
  const lines = [
    `${ok ? '✅' : '🔴'} *${input.projectName}* run finished`,
    `${counts.expected} passed · ${counts.unexpected} failed · ${counts.flaky} flaky · ${counts.skipped} skipped`,
  ]
  if (input.newlyFailing.length)
    lines.push(`*Newly failing (${input.newlyFailing.length}):* ${input.newlyFailing.slice(0, MAX_LISTED).join(', ')}`)
  if (input.newlyFlaky.length)
    lines.push(`*Newly flaky (${input.newlyFlaky.length}):* ${input.newlyFlaky.slice(0, MAX_LISTED).join(', ')}`)
  lines.push(`<${input.runUrl}|View run>`)
  return { text: lines.join('\n') }
}

export async function sendSlack(
  webhookUrl: string,
  payload: SlackPayload,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
  const res = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok)
    throw new Error(`slack webhook responded ${res.status}`)
}
