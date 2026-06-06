import type { KeepPolicy } from '../src/artifacts'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ingestPlaywrightReport } from '@kinora/core'
import { describe, expect, it } from 'vitest'
import { makeCopyArtifact } from '../src/artifacts'

// Minimal Playwright json report: one failing + one passing test, each with a
// trace attachment pointing at a file on disk.
function report(tracePath: string) {
  const traceAttachment = { name: 'trace', contentType: 'application/zip', path: tracePath }
  return {
    stats: { startTime: '2026-01-01T00:00:00Z', duration: 100, expected: 1, unexpected: 1, flaky: 0, skipped: 0 },
    suites: [{
      title: 'suite',
      file: 'a.spec.ts',
      specs: [
        { title: 'fails', ok: false, file: 'a.spec.ts', line: 1, column: 1, tests: [{ status: 'unexpected', projectName: 'chromium', results: [{ status: 'failed', attachments: [traceAttachment] }] }] },
        { title: 'passes', ok: true, file: 'a.spec.ts', line: 2, column: 1, tests: [{ status: 'expected', projectName: 'chromium', results: [{ status: 'passed', attachments: [traceAttachment] }] }] },
      ],
    }],
  }
}

function ingest(keep: KeepPolicy) {
  const out = mkdtempSync(path.join(tmpdir(), 'pb-cli-'))
  const tracePath = path.join(out, 'src-trace.zip')
  writeFileSync(tracePath, 'dummy-trace-bytes')
  const { report: r } = ingestPlaywrightReport(report(tracePath), {
    projectId: 'demo',
    runId: 'r1',
    copyArtifact: makeCopyArtifact(out, out, keep),
  })
  const traceUrl = (title: string) =>
    r.tests.find(t => t.title === title)?.attachments.find(a => a.name === 'trace')?.url
  return { out, fails: traceUrl('fails'), passes: traceUrl('passes') }
}

describe('cli artifact copy', () => {
  it('keep=failed copies the failing test trace, skips the passing one', () => {
    const { out, fails, passes } = ingest('failed')
    expect(fails).toBeTruthy()
    expect(existsSync(path.join(out, fails!))).toBe(true)
    expect(fails).toMatch(/^artifacts\/demo\/r1\/[a-f0-9]+\.zip$/)
    expect(passes).toBeUndefined()
  })

  it('keep=all copies both', () => {
    const { out, fails, passes } = ingest('all')
    expect(existsSync(path.join(out, fails!))).toBe(true)
    expect(existsSync(path.join(out, passes!))).toBe(true)
    // identical content -> deduped to the same sha1 filename
    expect(fails).toBe(passes)
  })

  it('keep=none copies nothing', () => {
    const { fails, passes } = ingest('none')
    expect(fails).toBeUndefined()
    expect(passes).toBeUndefined()
  })
})
