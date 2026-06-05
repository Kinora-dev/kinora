// Snapshot selection + URL building, ported from Playwright's snapshotTab.
import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel'
import { nextActionByStartTime, previousActionByEndTime } from '@isomorphic/trace/traceModel'

export interface Snapshot {
  snapshotName: string
  pageId: string
  point?: { x: number, y: number }
}

export interface Snapshots {
  action?: Snapshot
  before?: Snapshot
  after?: Snapshot
}

export type SnapshotTab = 'before' | 'action' | 'after'

type SnapshotKey = 'beforeSnapshot' | 'afterSnapshot' | 'inputSnapshot'

function createSnapshot(action: ActionTraceEventInContext | undefined, key: SnapshotKey): Snapshot | undefined {
  if (!action)
    return undefined
  const snapshotName = (action as any)[key] as string | undefined
  if (!snapshotName || !action.pageId)
    return undefined
  return { snapshotName, pageId: action.pageId, point: (action as any).point }
}

export function collectSnapshots(action: ActionTraceEventInContext | undefined): Snapshots {
  if (!action)
    return {}

  let before = createSnapshot(action, 'beforeSnapshot')
  if (!before) {
    for (let a = previousActionByEndTime(action); a; a = previousActionByEndTime(a)) {
      if (a.endTime <= action.startTime && (a as any).afterSnapshot) {
        before = createSnapshot(a as ActionTraceEventInContext, 'afterSnapshot')
        break
      }
    }
  }

  let after = createSnapshot(action, 'afterSnapshot')
  if (!after) {
    let last: ActionTraceEventInContext | undefined
    for (let a = nextActionByStartTime(action); a && a.startTime <= action.endTime; a = nextActionByStartTime(a)) {
      const aa = a as ActionTraceEventInContext
      if (aa.endTime > action.endTime || !(aa as any).afterSnapshot)
        continue
      if (last && last.endTime > aa.endTime)
        continue
      last = aa
    }
    after = last ? createSnapshot(last, 'afterSnapshot') : before
  }

  const action_ = createSnapshot(action, 'inputSnapshot') ?? after
  return { action: action_, before, after }
}

export function snapshotUrl(traceUri: string, snapshot: Snapshot | undefined): string | undefined {
  if (!snapshot)
    return undefined
  const params = new URLSearchParams()
  params.set('trace', traceUri)
  params.set('name', snapshot.snapshotName)
  if (snapshot.point) {
    params.set('pointX', String(snapshot.point.x))
    params.set('pointY', String(snapshot.point.y))
  }
  return new URL(`snapshot/${snapshot.pageId}?${params.toString()}`, location.href).toString()
}

export function snapshotInfoUrl(traceUri: string, snapshot: Snapshot | undefined): string | undefined {
  if (!snapshot)
    return undefined
  const params = new URLSearchParams()
  params.set('trace', traceUri)
  params.set('name', snapshot.snapshotName)
  return new URL(`snapshotInfo/${snapshot.pageId}?${params.toString()}`, location.href).toString()
}
