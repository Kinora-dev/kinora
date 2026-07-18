# @kinora/reporter

Playwright reporter that uploads your test results to a [kinora](https://github.com/Kinora-dev/kinora) server: pass rates, trends, flaky tests, and the full Playwright trace for failures, across projects and over time.

It runs on `onEnd`, posts the normalized run, then uploads the trace.zip for each failed/flaky test that has one. Upload never fails your test run.

## Install

```bash
npm i -D @kinora/reporter
# or: pnpm add -D @kinora/reporter
```

`@playwright/test` (>=1.40) is a peer dependency.

## Usage

Add it to `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [['@kinora/reporter', { project: { slug: 'web-app' } }]],
  // enable tracing so failures upload a trace
  use: { trace: 'on-first-retry' },
})
```

The token comes from the environment (keep it out of the config file); the server URL defaults to the hosted cloud:

```bash
KINORA_TOKEN=<token> npx playwright test
```

Create an API token in the kinora dashboard (Settings → Workspace). Self-hosting? Point at your server with `KINORA_URL` - see [selfhost/README.md](https://github.com/Kinora-dev/kinora/blob/main/selfhost/README.md).

## Options

```ts
[
  '@kinora/reporter',
  {
    project: { slug: 'web-app', name: 'Web App' },
  },
]
```

| Option    | Type                                 | Default                      | Description                                |
| --------- | ------------------------------------ | ---------------------------- | ------------------------------------------ |
| `project` | `{ slug: string, name?: string }`    | required                     | Target project. `name` defaults to `slug`. |
| `url`     | `string`                             | env `KINORA_URL`, then cloud | kinora server base URL. Set for self-host. |
| `token`   | `string`                             | env `KINORA_TOKEN`           | Project API token. Prefer the env var.     |
| `git`     | `{ sha?, branch?, baseBranch?, repoUrl? }` | auto on GitHub Actions | Git metadata. `repoUrl` links a sha to its commit; `baseBranch` powers "regression vs base" in the PR comment. |
| `ci`      | `{ provider?, runUrl?, runNumber? }` | auto on GitHub Actions       | CI metadata for the run.                   |
| `prComment` | `boolean \| { label?, policy? }`   | off                          | Post/update a summary comment on the GitHub PR (see below). |

On GitHub Actions, `git` and `ci` are filled from the standard `GITHUB_*` env vars (including the repo URL, so shas link to their commit in the dashboard). Pass them explicitly on other CI providers.

## GitHub PR comment

On a `pull_request` run, the reporter can post (and keep updating) a summary comment on the PR: pass/fail counts, tests newly failing vs the base branch, and a link to the run. It uses the job's ambient `GITHUB_TOKEN`, so no credentials are stored in kinora.

```ts
reporter: [['@kinora/reporter', { project: { slug: 'web-app' }, prComment: true }]]
```

The workflow must grant write access to PRs:

```yaml
# in your workflow job:
permissions:
  pull-requests: write # required for the PR comment
steps:
  - run: npx playwright test
    env:
      KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
```

- Same-repo PRs only: `GITHUB_TOKEN` is read-only on fork PRs, so the comment is skipped there.
- Shard your run with `merge-reports` (blob report) so one merged run posts one comment; per-shard runs are skipped.
- Matrix builds sharing a PR: set `prComment: { label: 'node20' }` so each leg keeps its own comment.
- `policy: 'on-failure'` skips the comment on green runs (default posts always).

## CI example (GitHub Actions)

```yaml
- run: npx playwright test
  env:
    KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
```

## Notes

- If `KINORA_TOKEN` is missing, the reporter logs a warning and skips the upload, so local runs aren't affected. `KINORA_URL` is optional (defaults to the hosted cloud).
- Traces are uploaded only for tests that produced one, so enable `trace` in your Playwright config (`on-first-retry`, `retain-on-failure`, etc.).
- Cross-run test identity is the file + title path + Playwright project name, so history stays stable as long as those don't change.

## License

MIT
