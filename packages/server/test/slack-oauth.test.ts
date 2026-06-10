import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { decodeState, encodeState } from '../src/slack/oauth'

describe('slack oauth state', () => {
  const payload = { projectId: 'p1', userId: 'u1', slug: 'web-app' }

  it('round-trips a signed state', () => {
    expect(decodeState(encodeState(payload))).toEqual(payload)
  })

  it('rejects a tampered signature', () => {
    const [body] = encodeState(payload).split('.')
    expect(decodeState(`${body}.deadbeefdeadbeef`)).toBeNull()
  })

  it('rejects a forged body kept under the original signature', () => {
    const sig = encodeState(payload).split('.')[1]
    const forged = Buffer.from(JSON.stringify({ ...payload, userId: 'attacker', exp: Date.now() + 10_000 })).toString('base64url')
    expect(decodeState(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(decodeState('garbage')).toBeNull()
    expect(decodeState('')).toBeNull()
  })
})
