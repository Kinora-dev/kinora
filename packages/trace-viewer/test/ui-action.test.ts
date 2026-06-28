import { describe, expect, it } from 'vitest'
import { actionDuration, actionStatus, actionTitle } from '../src/ui/lib/action'

type Action = Parameters<typeof actionStatus>[0]

function action(over: Record<string, unknown> = {}): Action {
  return { class: 'Page', method: 'click', params: {}, startTime: 0, endTime: 0, ...over } as unknown as Action
}

describe('actionStatus', () => {
  it('is error when the action has an error message', () => {
    expect(actionStatus(action({ error: { message: 'boom' } }))).toBe('error')
  })

  it('is step for a Test action', () => {
    expect(actionStatus(action({ class: 'Test' }))).toBe('step')
  })

  it('is ok otherwise', () => {
    expect(actionStatus(action())).toBe('ok')
  })
})

describe('actionDuration', () => {
  it('is the elapsed time when both timestamps are present', () => {
    expect(actionDuration(action({ startTime: 100, endTime: 250 }))).toBe(150)
  })

  it('is undefined when an endTime is missing', () => {
    expect(actionDuration(action({ startTime: 100, endTime: 0 }))).toBeUndefined()
  })
})

describe('actionTitle', () => {
  it('returns a non-empty title, falling back to class.method', () => {
    const title = actionTitle(action({ class: 'Page', method: 'click' }))
    expect(typeof title).toBe('string')
    expect(title.length).toBeGreaterThan(0)
  })
})
