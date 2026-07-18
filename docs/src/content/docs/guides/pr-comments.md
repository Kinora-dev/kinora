---
title: GitHub PR comments
description: Post a summary comment on the pull request straight from CI, using the job's own GITHUB_TOKEN.
---

On a `pull_request` run, kinora can post (and keep updating) a summary comment on the PR:
pass/fail counts, tests newly failing versus the base branch, and a link to the run. It uses the
CI job's ambient `GITHUB_TOKEN`, so **no credentials are stored in kinora**. It works the same on
cloud and self-host.

Both upload paths support it: the [reporter](/guides/reporter/) and the [CLI](/guides/cli/).

## Reporter

```ts
reporter: [['@kinora/reporter', { project: { slug: 'web-app' }, prComment: true }]]
```

## CLI

```bash
npx @kinora/cli upload results.json --project web-app --pr-comment
```

## Required workflow permission

The comment is posted with the job's `GITHUB_TOKEN`, which must be granted write access to PRs:

```yaml
# in your workflow job:
permissions:
  pull-requests: write # required for the PR comment
steps:
  - run: npx playwright test
    env:
      KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
```

## Regression vs the base branch

The comment lists tests **newly failing versus the PR's base branch**. This needs the base
branch name, which auto-detects from `GITHUB_BASE_REF` on a `pull_request` run (or set it
explicitly: reporter `git.baseBranch`, CLI `--git-base-branch`). kinora compares the PR run's
tests against the latest run on the base branch to compute what regressed.

## Edge cases

- **Fork PRs are skipped.** `GITHUB_TOKEN` is read-only on pull requests from forks, so the
  comment can't be posted there and is silently skipped.
- **Sharded runs**: shard with `merge-reports` (blob report) so one merged run posts one comment.
  Per-shard runs are skipped.
- **Matrix builds sharing a PR**: give each leg its own label so they keep separate comments -
  reporter `prComment: { label: 'node20' }`, CLI `--pr-label node20`.
- **Green runs**: `policy: 'on-failure'` (reporter) / `--pr-policy on-failure` (CLI) skips the
  comment when the run passes. The default posts always.

## How the comment stays single

kinora tags its comment with a hidden marker keyed by project (and label, if set), finds its own
previous comment on the PR, and edits it in place. Re-running the job updates the same comment
rather than adding a new one.
