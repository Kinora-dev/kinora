import type { CiMeta, Counts, GitMeta, IngestRun, IngestRunResult, NormTest } from '@kinora/core'
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createIngestClient, DEFAULT_KINORA_URL, effectiveAttachments, IngestError, isTraceAttachment, makeTestKey, postPrComment, resolvePrContext } from '@kinora/core'

export interface KinoraReporterOptions {
  /** kinora server base URL. Defaults to env KINORA_URL, then the hosted cloud. Set for self-host. */
  url?: string
  /** Project API token. Defaults to env KINORA_TOKEN (keep it out of the config file). */
  token?: string
  /** Target project. `name` defaults to `slug`. */
  project: { slug: string, name?: string }
  git?: GitMeta
  ci?: CiMeta
  /**
   * Post/update a summary comment on the GitHub PR (uses the job's GITHUB_TOKEN; needs
   * `permissions: pull-requests: write`). `label` distinguishes matrix legs sharing one PR.
   */
  prComment?: boolean | { label?: string, policy?: 'always' | 'on-failure' }
}

// Rebuild the json-report identity (file path + title path + project) from the
// reporter suite tree so testKey matches the CLI path. Suite titles: file path
// for `file` suites, describe title for `describe`, project name for `project`.
function identity(test: TestCase): { file: string, titlePath: string[], projectName: string } {
  let file = ''
  let projectName = ''
  const describes: string[] = []
  let suite: Suite | undefined = test.parent
  while (suite) {
    if (suite.type === 'file')
      file = suite.title
    else if (suite.type === 'project')
      projectName = suite.title
    else if (suite.type === 'describe' && suite.title)
      describes.unshift(suite.title)
    suite = suite.parent
  }
  return { file, titlePath: [file, ...describes, test.title], projectName }
}

function toNormTest(test: TestCase): NormTest {
  const { file, titlePath, projectName } = identity(test)
  const last = test.results.at(-1)
  return {
    testKey: makeTestKey(file, titlePath, projectName),
    title: test.title,
    titlePath,
    file,
    line: test.location.line,
    column: test.location.column,
    projectName,
    status: test.outcome(),
    ok: test.ok(),
    duration: test.results.reduce((sum, r) => sum + r.duration, 0),
    retries: Math.max(0, test.results.length - 1),
    tags: test.tags,
    annotations: test.annotations.map(a => ({ type: a.type, description: a.description })),
    errors: (last?.errors ?? []).flatMap(e =>
      e.message ? [{ message: e.message, stack: e.stack, location: e.location }] : [],
    ),
    attachments: effectiveAttachments(test.results).map(a => ({
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      hasBody: a.body != null,
    })),
  }
}

function countsOf(tests: NormTest[]): Counts {
  const counts: Counts = { total: tests.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0 }
  for (const t of tests)
    counts[t.status]++
  return counts
}

function detectGit(): GitMeta | undefined {
  const sha = process.env.GITHUB_SHA
  const branch = process.env.GITHUB_REF_NAME
  const baseBranch = process.env.GITHUB_BASE_REF || undefined // set on pull_request events
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env
  const repoUrl = GITHUB_SERVER_URL && GITHUB_REPOSITORY ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}` : undefined
  if (!sha && !branch && !repoUrl)
    return undefined
  return { sha, branch, baseBranch, repoUrl }
}

function detectCi(): CiMeta | undefined {
  if (!process.env.GITHUB_ACTIONS)
    return undefined
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_NUMBER } = process.env
  const runUrl = GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : undefined
  return { provider: 'github', runUrl, runNumber: GITHUB_RUN_NUMBER }
}

export default class KinoraReporter implements Reporter {
  private suite: Suite | undefined
  private config: FullConfig | undefined

  constructor(private readonly options: KinoraReporterOptions) {}

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config
    this.suite = suite
  }

  async onEnd(result: FullResult): Promise<void> {
    const url = this.options.url ?? process.env.KINORA_URL ?? DEFAULT_KINORA_URL
    const token = this.options.token ?? process.env.KINORA_TOKEN
    if (!token) {
      console.warn('[kinora] skipping upload: missing token (set KINORA_TOKEN)')
      return
    }

    const tests = (this.suite?.allTests() ?? []).map(toNormTest)
    const payload: IngestRun = {
      project: { slug: this.options.project.slug, name: this.options.project.name ?? this.options.project.slug },
      run: {
        startedAt: result.startTime.toISOString(),
        duration: result.duration,
        counts: countsOf(tests),
        playwrightVersion: this.config?.version,
        git: this.options.git ?? detectGit(),
        ci: this.options.ci ?? detectCi(),
      },
      tests,
    }

    try {
      const client = createIngestClient({ baseUrl: url, token, regression: !!this.options.prComment })
      const res = await client.uploadRun(payload)

      let traces = 0
      for (const t of tests) {
        for (const a of t.attachments) {
          if (!a.path || !isTraceAttachment(a))
            continue
          try {
            await client.uploadArtifact({ runId: res.runId, testKey: t.testKey, name: a.name, contentType: a.contentType, body: await readFile(a.path) })
            traces++
          }
          catch (err) {
            console.warn(`[kinora] trace upload failed for ${t.testKey}:`, err instanceof Error ? err.message : err)
          }
        }
      }
      // eslint-disable-next-line no-console -- a reporter's job is to report
      console.log(`[kinora] uploaded ${res.tests} tests + ${traces} traces (run ${res.runId})`)

      await this.maybePostPrComment(payload, res)
    }
    catch (err) {
      if (err instanceof IngestError && err.status === 402)
        console.warn(`[kinora] ${err.message}`)
      else
        console.error(`[kinora] upload failed:`, err instanceof Error ? err.message : err)
    }
  }

  // Best-effort GitHub PR comment from the CI job. Never throws (mirrors "upload never fails the run").
  private async maybePostPrComment(payload: IngestRun, res: IngestRunResult): Promise<void> {
    if (!this.options.prComment)
      return
    const opt = this.options.prComment
    const label = typeof opt === 'object' ? opt.label : undefined
    const policy = typeof opt === 'object' ? opt.policy : undefined
    try {
      // config.shard set => a per-shard run; only the merged/single run should comment.
      const env = this.config?.shard ? { ...process.env, __KINORA_IS_SHARD: '1' } : process.env
      const ctx = resolvePrContext(env, (p) => {
        try {
          return readFileSync(p, 'utf8')
        }
        catch {
          return undefined
        }
      })
      if (!ctx)
        return
      const outcome = await postPrComment(ctx, {
        projectSlug: payload.project.slug,
        projectName: payload.project.name,
        label,
        runUrl: res.runUrl,
        ciRunUrl: payload.run.ci?.runUrl,
        counts: payload.run.counts,
        regression: res.regression,
      }, policy ?? 'always')
      if (outcome !== 'skipped')
        console.warn(`[kinora] PR comment ${outcome}`)
    }
    catch (err) {
      console.warn('[kinora] PR comment failed:', err instanceof Error ? err.message : err)
    }
  }
}
