import type { Counts } from '../contracts/kinora'
import { describe, expect, it, vi } from 'vitest'
import { buildPrCommentBody, postPrComment, resolvePrContext } from './pr-comment'

const prEnv = {
  GITHUB_TOKEN: 'tok',
  GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_REPOSITORY: 'acme/app',
  GITHUB_REF: 'refs/pull/42/merge',
}

const counts: Counts = { total: 10, expected: 8, unexpected: 1, flaky: 1, skipped: 0 }
const green: Counts = { total: 10, expected: 10, unexpected: 0, flaky: 0, skipped: 0 }

describe('resolvePrContext', () => {
  it('resolves owner/repo/prNumber from a pull_request ref', () => {
    expect(resolvePrContext(prEnv, () => undefined)).toMatchObject({ owner: 'acme', repo: 'app', prNumber: 42, apiUrl: 'https://api.github.com' })
  })

  it('prefers the event payload PR number over the ref', () => {
    const ctx = resolvePrContext({ ...prEnv, GITHUB_EVENT_PATH: '/evt', GITHUB_REF: 'refs/heads/x' }, () => JSON.stringify({ pull_request: { number: 7 } }))
    expect(ctx?.prNumber).toBe(7)
  })

  it('honors GITHUB_API_URL for GHES', () => {
    expect(resolvePrContext({ ...prEnv, GITHUB_API_URL: 'https://ghe.acme.com/api/v3' }, () => undefined)?.apiUrl).toBe('https://ghe.acme.com/api/v3')
  })

  it('returns null off a PR (push event)', () => {
    expect(resolvePrContext({ ...prEnv, GITHUB_EVENT_NAME: 'push' }, () => undefined)).toBeNull()
  })

  it('rejects pull_request_target (privileged fork-content token)', () => {
    expect(resolvePrContext({ ...prEnv, GITHUB_EVENT_NAME: 'pull_request_target' }, () => undefined)).toBeNull()
  })

  it('returns null without a token', () => {
    expect(resolvePrContext({ ...prEnv, GITHUB_TOKEN: undefined }, () => undefined)).toBeNull()
  })
})

describe('buildPrCommentBody', () => {
  it('includes counts, regression, links, and the project marker', () => {
    const body = buildPrCommentBody({
      projectSlug: 'web',
      projectName: 'Web',
      runUrl: 'https://app.kinora.dev/x',
      counts,
      regression: { base: 'base-branch', newlyFailing: [{ testKey: 'k', title: 'login', file: 'a.spec.ts' }], newlyFlaky: [], fixed: 2 },
    })
    expect(body).toContain('**1 failed**')
    expect(body).toContain('1 newly failing** vs base branch')
    expect(body).toContain('`login`') // titles are code-spanned to neutralize @mentions/#refs/markers
    expect(body).toContain('2 fixed vs base branch')
    expect(body).toContain('https://app.kinora.dev/x')
    expect(body).toContain('<!-- kinora:pr:web -->')
  })

  it('truncates a long failing list', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ testKey: `k${i}`, title: `t${i}`, file: 'f' }))
    const body = buildPrCommentBody({ projectSlug: 'web', projectName: 'Web', counts, regression: { base: 'previous-run', newlyFailing: many, newlyFlaky: [], fixed: 0 } })
    expect(body).toContain('and 5 more')
  })

  it('keys the marker by label for matrix legs', () => {
    expect(buildPrCommentBody({ projectSlug: 'web', projectName: 'Web', label: 'node20', counts })).toContain('<!-- kinora:pr:web:node20 -->')
  })

  it('neutralizes a malicious test title (mention/marker inside a code span)', () => {
    const body = buildPrCommentBody({
      projectSlug: 'web',
      projectName: 'Web',
      counts,
      regression: { base: 'base-branch', newlyFailing: [{ testKey: 'k', title: '@maintainer <!-- kinora:pr:web -->', file: 'a.ts' }], newlyFlaky: [], fixed: 0 },
    })
    // The title is wrapped in backticks, so its @mention/marker cannot escape into rendered markdown.
    expect(body).toContain('`@maintainer <!-- kinora:pr:web -->`')
  })
})

describe('postPrComment', () => {
  const ctx = { token: 't', apiUrl: 'https://api.github.com', owner: 'a', repo: 'r', prNumber: 1, isShard: false }
  const input = { projectSlug: 'web', projectName: 'Web', counts }

  it('creates a comment when none carries the marker', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    expect(await postPrComment(ctx, input, 'always', fetch as unknown as typeof globalThis.fetch)).toBe('created')
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/issues/1/comments'), expect.objectContaining({ method: 'POST' }))
  })

  it('updates our own bot comment carrying the marker on its last line', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 9, body: 'summary\n<!-- kinora:pr:web -->', user: { type: 'Bot' } }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    expect(await postPrComment(ctx, input, 'always', fetch as unknown as typeof globalThis.fetch)).toBe('updated')
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/issues/comments/9'), expect.objectContaining({ method: 'PATCH' }))
  })

  it('does not hijack a human comment that quotes the marker', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 5, body: 'look: <!-- kinora:pr:web -->', user: { type: 'User' } }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    expect(await postPrComment(ctx, input, 'always', fetch as unknown as typeof globalThis.fetch)).toBe('created')
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/issues/1/comments'), expect.objectContaining({ method: 'POST' }))
  })

  it('skips on a per-shard run', async () => {
    expect(await postPrComment({ ...ctx, isShard: true }, input, 'always', vi.fn() as unknown as typeof globalThis.fetch)).toBe('skipped')
  })

  it('skips a green run under the on-failure policy', async () => {
    expect(await postPrComment(ctx, { ...input, counts: green }, 'on-failure', vi.fn() as unknown as typeof globalThis.fetch)).toBe('skipped')
  })
})
