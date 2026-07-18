import type { RunRegression } from '../contracts/ingest'
import type { Counts } from '../contracts/kinora'

// Post/update a single GitHub PR comment from the CI job, using the ambient GITHUB_TOKEN.
// env + file reads are injected so this module stays node-free (safe to bundle for the web).

export interface PrContext {
  token: string
  apiUrl: string // GITHUB_API_URL (differs on GHES)
  owner: string
  repo: string
  prNumber: number
  isShard: boolean // a per-shard run: skip so only the merged/single run comments
}

export type PrCommentPolicy = 'always' | 'on-failure'

export interface PrCommentInput {
  projectSlug: string
  projectName: string
  label?: string // distinguishes matrix legs sharing a PR
  runUrl?: string
  ciRunUrl?: string
  counts: Counts
  regression?: RunRegression
}

const MAX_LISTED = 15 // cap the failing-test list so the comment stays under GitHub's size limit

// Resolve the PR context from CI env. Returns null when not a same-repo pull_request with a token.
export function resolvePrContext(
  env: Record<string, string | undefined>,
  readFile: (path: string) => string | undefined,
): PrContext | null {
  const token = env.GITHUB_TOKEN
  const eventName = env.GITHUB_EVENT_NAME
  const repository = env.GITHUB_REPOSITORY
  if (!token || !repository)
    return null
  // pull_request only: pull_request_target grants a write token to fork-authored content, which
  // would let a fork inject into a comment posted under privileged credentials.
  if (eventName !== 'pull_request')
    return null

  const [owner, repo] = repository.split('/')
  if (!owner || !repo)
    return null

  const prNumber = prNumberFrom(env, readFile)
  if (prNumber == null)
    return null

  return {
    token,
    apiUrl: env.GITHUB_API_URL || 'https://api.github.com',
    owner,
    repo,
    prNumber,
    isShard: !!env.__KINORA_IS_SHARD, // set by the reporter when config.shard is present
  }
}

function prNumberFrom(env: Record<string, string | undefined>, readFile: (path: string) => string | undefined): number | null {
  // Event payload is the reliable source; fall back to parsing refs/pull/<N>/merge.
  const eventPath = env.GITHUB_EVENT_PATH
  if (eventPath) {
    try {
      const raw = readFile(eventPath)
      if (raw) {
        const event = JSON.parse(raw) as { pull_request?: { number?: number }, number?: number }
        const n = event.pull_request?.number ?? event.number
        if (typeof n === 'number')
          return n
      }
    }
    catch {
      // fall through to ref parsing
    }
  }
  const m = env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\//)
  return m ? Number(m[1]) : null
}

function marker(projectSlug: string, label?: string): string {
  return `<!-- kinora:pr:${projectSlug}${label ? `:${label}` : ''} -->`
}

// Untrusted test titles/paths go through an inline code span so GitHub won't autolink @mentions /
// #refs, render markdown, or let a crafted title emit the HTML-comment marker.
function inlineCode(s: string): string {
  return `\`${s.replace(/`/g, '‘').replace(/\r?\n/g, ' ')}\``
}

export function buildPrCommentBody(input: PrCommentInput): string {
  const { counts, regression } = input
  const failed = counts.unexpected
  const icon = failed > 0 ? '❌' : counts.flaky > 0 ? '⚠️' : '✅'
  const lines: string[] = []

  lines.push(`${icon} **kinora** · ${input.projectName}`)
  lines.push('')
  lines.push(`\`${counts.expected + counts.flaky}/${counts.total} passed\` · **${failed} failed** · ${counts.flaky} flaky · ${counts.skipped} skipped`)

  if (regression && regression.base !== 'none') {
    const vs = regression.base === 'base-branch' ? 'base branch' : 'previous run'
    if (regression.newlyFailing.length) {
      lines.push('')
      lines.push(`**${regression.newlyFailing.length} newly failing** vs ${vs}:`)
      for (const t of regression.newlyFailing.slice(0, MAX_LISTED))
        lines.push(`- ${inlineCode(t.file)} › ${inlineCode(t.title)}`)
      if (regression.newlyFailing.length > MAX_LISTED)
        lines.push(`- …and ${regression.newlyFailing.length - MAX_LISTED} more`)
    }
    if (regression.newlyFlaky.length)
      lines.push(`\n**${regression.newlyFlaky.length} newly flaky** vs ${vs}.`)
    if (regression.fixed > 0)
      lines.push(`\n✅ ${regression.fixed} fixed vs ${vs}.`)
    if (!regression.newlyFailing.length && !regression.newlyFlaky.length && regression.fixed === 0)
      lines.push(`\nNo change vs ${vs}.`)
  }

  const links: string[] = []
  if (input.runUrl)
    links.push(`[View run in kinora](${input.runUrl})`)
  if (input.ciRunUrl)
    links.push(`[CI run](${input.ciRunUrl})`)
  if (links.length) {
    lines.push('')
    lines.push(links.join(' · '))
  }

  lines.push('')
  lines.push(marker(input.projectSlug, input.label))
  return lines.join('\n')
}

interface GhComment { id: number, body?: string, user?: { type?: string } }

// Upsert the comment: update our previous bot comment (carrying the marker), else create one.
// A fork PR's GITHUB_TOKEN is read-only, so writes 403 -> treated as skipped, not an error.
export async function postPrComment(
  ctx: PrContext,
  input: PrCommentInput,
  policy: PrCommentPolicy = 'always',
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<'created' | 'updated' | 'skipped'> {
  if (ctx.isShard)
    return 'skipped'
  // newlyFailing entries always have an unexpected head status, so counts.unexpected===0 covers them.
  if (policy === 'on-failure' && input.counts.unexpected === 0)
    return 'skipped'

  const headers = {
    'authorization': `Bearer ${ctx.token}`,
    'accept': 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'content-type': 'application/json',
  }
  const base = `${ctx.apiUrl}/repos/${ctx.owner}/${ctx.repo}`
  const body = buildPrCommentBody(input)
  const mark = marker(input.projectSlug, input.label)

  // Page through comments; only our own bot comment carrying the marker is a valid upsert target
  // (a human comment quoting the marker must not be hijacked).
  let existing: GhComment | undefined
  for (let page = 1; ; page++) {
    const listRes = await fetchImpl(`${base}/issues/${ctx.prNumber}/comments?per_page=100&page=${page}`, { headers })
    if (!listRes.ok) {
      if (listRes.status === 403)
        return 'skipped'
      throw new Error(`github: list comments failed (${listRes.status})`)
    }
    const batch = (await listRes.json()) as GhComment[]
    // Match our own bot comment by the marker on its LAST line (buildPrCommentBody always ends with
    // it), so a marker embedded mid-body by a crafted test title can't redirect the upsert.
    existing = batch.find(c => c.user?.type === 'Bot' && !!c.body && c.body.trimEnd().endsWith(mark))
    if (existing || batch.length < 100)
      break
  }

  const target = existing
    ? { url: `${base}/issues/comments/${existing.id}`, method: 'PATCH' as const, outcome: 'updated' as const }
    : { url: `${base}/issues/${ctx.prNumber}/comments`, method: 'POST' as const, outcome: 'created' as const }

  const res = await fetchImpl(target.url, { method: target.method, headers, body: JSON.stringify({ body }) })
  if (!res.ok) {
    if (res.status === 403)
      return 'skipped'
    throw new Error(`github: ${target.outcome} comment failed (${res.status})`)
  }
  return target.outcome
}
