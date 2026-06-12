import { describe, expect, it, vi } from 'vitest'
import { sendMail } from '../src/lib/mailer'

describe('sendMail', () => {
  it('sends through the transport with the configured from', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue(undefined) }
    sendMail({ to: 'a@b.dev', subject: 'hi', text: 'body' }, transport, 'kinora <no-reply@kinora.dev>')

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'kinora <no-reply@kinora.dev>',
      to: 'a@b.dev',
      subject: 'hi',
      text: 'body',
    })
  })

  it('skips silently when smtp is not configured', () => {
    const transport = { sendMail: vi.fn() }
    sendMail({ to: 'a@b.dev', subject: 'hi', text: 'body' }, null)
    sendMail({ to: 'a@b.dev', subject: 'hi', text: 'body' }, transport, undefined)
    expect(transport.sendMail).not.toHaveBeenCalled()
  })

  it('swallows transport failures', async () => {
    const transport = { sendMail: vi.fn().mockRejectedValue(new Error('boom')) }
    expect(() => sendMail({ to: 'a@b.dev', subject: 'hi', text: 'body' }, transport, 'x@y.dev')).not.toThrow()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
})
