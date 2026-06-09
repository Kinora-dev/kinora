import { describe, expect, it, vi } from 'vitest'
import { buildSlackMessage, sendSlack } from '../src/alerts/slack'

describe('buildSlackMessage', () => {
  it('marks a passing run and links to it', () => {
    const msg = buildSlackMessage({
      projectName: 'web-app',
      runUrl: 'http://x/r',
      counts: { total: 2, expected: 2, unexpected: 0, flaky: 0, skipped: 0 },
      newlyFailing: [],
      newlyFlaky: [],
    })
    expect(msg.text).toContain('✅')
    expect(msg.text).toContain('web-app')
    expect(msg.text).toContain('<http://x/r|View run>')
    expect(msg.text).not.toContain('Newly failing')
  })

  it('marks failures and lists newly failing tests', () => {
    const msg = buildSlackMessage({
      projectName: 'web-app',
      runUrl: 'http://x/r',
      counts: { total: 2, expected: 1, unexpected: 1, flaky: 0, skipped: 0 },
      newlyFailing: ['login spec'],
      newlyFlaky: [],
    })
    expect(msg.text).toContain('🔴')
    expect(msg.text).toContain('Newly failing (1)')
    expect(msg.text).toContain('login spec')
  })
})

describe('sendSlack', () => {
  it('throws on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    await expect(sendSlack('http://x', { text: 'hi' }, fetchMock)).rejects.toThrow()
  })

  it('posts JSON to the webhook url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    await sendSlack('http://x', { text: 'hi' }, fetchMock)
    expect(fetchMock).toHaveBeenCalledWith('http://x', expect.objectContaining({ method: 'POST' }))
  })
})
