export interface TimeRange {
  start: number
  end: number
}

export function normalizeRange(a: number, b: number): TimeRange {
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

// Pixel offset within a [0, width] track -> absolute time within [min, min + span].
export function xToTime(x: number, width: number, min: number, span: number): number {
  if (width <= 0)
    return min
  const clamped = Math.min(Math.max(x, 0), width)
  return min + (clamped / width) * span
}

export function inWindow(t: number | undefined, range: TimeRange): boolean {
  return t !== undefined && t >= range.start && t <= range.end
}

// An action belongs to the window when its [start, end] span intersects it.
export function actionInWindow(action: { startTime?: number, endTime?: number }, range: TimeRange): boolean {
  const start = action.startTime ?? 0
  const end = action.endTime ?? start
  return end >= range.start && start <= range.end
}
