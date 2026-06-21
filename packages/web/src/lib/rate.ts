// Pass-rate color, by value: high = pass, mid = caution, low = fail. Used everywhere a pass-rate % is
// shown so the colour is consistent; the run/test health state is carried separately by the badge.
export function passRateTone(rate: number): 'pass' | 'flaky' | 'fail' {
  return rate >= 0.95 ? 'pass' : rate >= 0.9 ? 'flaky' : 'fail'
}

// Same thresholds, as a text-color class (for the non-StatBlock spots: the project card number + sparkline).
export function passRateTextClass(rate: number): string {
  return { pass: 'text-pass', flaky: 'text-flaky', fail: 'text-fail' }[passRateTone(rate)]
}
