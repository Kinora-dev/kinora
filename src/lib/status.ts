import type { PwTestStatus } from '@/contracts/playwright'

export const pwStatusMeta: Record<
  PwTestStatus,
  { label: string; dot: string; text: string; cell: string }
> = {
  expected: { label: 'Pass', dot: 'bg-pass', text: 'text-pass', cell: 'bg-pass' },
  unexpected: { label: 'Fail', dot: 'bg-fail', text: 'text-fail', cell: 'bg-fail' },
  flaky: { label: 'Flaky', dot: 'bg-flaky', text: 'text-flaky', cell: 'bg-flaky' },
  skipped: {
    label: 'Skip',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    cell: 'bg-muted-foreground/40',
  },
}
