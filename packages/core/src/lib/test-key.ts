// Stable identity for a test across runs: file + full title path + pw project.
// Lets the history view follow the same test even as suites are reordered.
export function makeTestKey(file: string, titlePath: string[], projectName: string): string {
  return [file, titlePath.join(' › '), projectName].join('::')
}
