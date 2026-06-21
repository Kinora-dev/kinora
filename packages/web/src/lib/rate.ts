// Tone for an aggregate pass rate (over many runs): high = pass, mid = caution, low = fail.
export function passRateTone(rate: number): 'pass' | 'flaky' | 'fail' {
  return rate >= 0.95 ? 'pass' : rate >= 0.9 ? 'flaky' : 'fail'
}
