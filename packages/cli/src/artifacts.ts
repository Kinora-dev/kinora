import type { CopyArtifact } from '@playbackhq/core'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type KeepPolicy = 'failed' | 'all' | 'none'

// Copies trace.zip artifacts into <out>/artifacts/<project>/<run>/<sha1>.zip so
// the dashboard can link the trace viewer at one. Traces only, for now.
export function makeCopyArtifact(outDir: string, resultsDir: string, keep: KeepPolicy): CopyArtifact {
  return (att, ctx) => {
    if (keep === 'none')
      return undefined
    if (keep === 'failed' && ctx.status !== 'unexpected' && ctx.status !== 'flaky')
      return undefined

    const isTrace = att.name === 'trace' || att.contentType === 'application/zip'
    if (!isTrace)
      return undefined

    let buf: Buffer | undefined
    if (att.path) {
      const file = path.isAbsolute(att.path) ? att.path : path.resolve(resultsDir, att.path)
      if (existsSync(file))
        buf = readFileSync(file)
    }
    if (!buf && att.body)
      buf = Buffer.from(att.body, 'base64')
    if (!buf)
      return undefined

    const sha = createHash('sha1').update(buf).digest('hex').slice(0, 16)
    const rel = `artifacts/${ctx.projectId}/${ctx.runId}/${sha}.zip`
    const dest = path.join(outDir, rel)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    return rel
  }
}
