// Human label for a test row: the suite path + title without the leading file. titlePath[0] is the
// file (shown separately in the UI), so drop it; fall back to the title when there's no suite hierarchy.
export function testLabel(t: { titlePath: string[], title: string }): string {
  return t.titlePath.slice(1).join(' › ') || t.title
}
