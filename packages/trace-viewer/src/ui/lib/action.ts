import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel'
import { renderTitleForCall } from '@isomorphic/protocolFormatter'

export type ActionStatus = 'ok' | 'error' | 'step'

export function actionTitle(action: ActionTraceEventInContext): string {
  const title = renderTitleForCall({
    title: action.title,
    type: action.class,
    method: action.method,
    params: action.params,
  })
  return title || `${action.class}.${action.method}`
}

export function actionStatus(action: ActionTraceEventInContext): ActionStatus {
  if (action.error?.message)
    return 'error'
  if (action.class === 'Test')
    return 'step'
  return 'ok'
}

export function actionDuration(action: ActionTraceEventInContext): number | undefined {
  if (action.endTime && action.startTime)
    return action.endTime - action.startTime
  return undefined
}
