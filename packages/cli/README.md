# @kinora/cli

CLI that uploads a Playwright `json` report to a [kinora](https://github.com/Kinora-dev/kinora) server. Use it when you can't run the [`@kinora/reporter`](https://github.com/Kinora-dev/kinora/tree/main/packages/reporter) inline (e.g. results are produced in one CI job and uploaded from another), or to bulk-import a backlog of historical reports.

## Upload a single report

Produce `results.json` with Playwright's built-in json reporter:

```ts
// playwright.config.ts
reporter: [['json', { outputFile: 'results.json' }]]
```

Then upload it:

```bash
npx @kinora/cli upload results.json --project web-app --token <project-token>
```

Create a project API token in the kinora dashboard (Settings → Workspace). Auth can also come from the environment: `KINORA_TOKEN` and `KINORA_URL`. Self-hosting? Point at your server with `--url` / `KINORA_URL` - see [selfhost/README.md](https://github.com/Kinora-dev/kinora/blob/main/selfhost/README.md).

## Bulk import (historical backfill)

Import every `*.json` report under a directory in one go - useful for seeding history from an existing archive. Billing follows test execution date, so runs from past periods are free and don't consume your current quota; only current-period runs count. Imported runs also skip alerts (no notification spam).

Traces are not uploaded by `import`: the reporter and `kinora upload` push traces because the `trace.zip` sits on disk next to the run, but a JSON-only archive has no zips to send. History (pass rates, trends, flaky detection) still works without them.

```bash
npx @kinora/cli import ./reports --project web-app --token <project-token> --concurrency 8
```

## Options

```
--project <slug>      required, target project slug
--token <token>       project API token (or env KINORA_TOKEN)
--url <url>           server base URL (or env KINORA_URL; default: hosted cloud, set for self-host)
--name <name>         project display name (default: slug)
--git-sha <sha>
--git-branch <branch>
--git-repo-url <url>  remote URL (https://github.com/org/repo) to link shas to commits
--ci-provider <name>
--ci-run-url <url>
--ci-run-number <n>
--git-base-branch <b> PR base branch (or env GITHUB_BASE_REF); powers "regression vs base"
--pr-comment          post/update a summary on the GitHub PR (needs GITHUB_TOKEN + pull-requests: write)
--pr-label <label>    distinguish matrix legs that share one PR
--pr-policy <policy>  always (default) | on-failure (skip the comment on green runs)
--concurrency <n>     parallel uploads for bulk import (default: 6)
-h, --help
```

On GitHub Actions, `git` and `ci` metadata (including the repo URL) auto-detect from the standard `GITHUB_*` env vars; the flags override them. Pass the flags explicitly on other CI providers.

## GitHub PR comment

Same feature as the reporter, from the upload step: `--pr-comment` posts (and keeps updating) a summary on the `pull_request`: pass/fail counts, tests newly failing vs the base branch, and a link to the run. It uses the job's `GITHUB_TOKEN`, so kinora stores no credentials.

```yaml
# in your workflow job:
permissions:
  pull-requests: write # required for the PR comment
steps:
  - run: npx @kinora/cli upload results.json --project web-app --pr-comment
    env:
      KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
```

Same-repo PRs only (fork tokens are read-only). Matrix legs sharing a PR: add `--pr-label <label>` so each keeps its own comment.

## CI example (GitHub Actions)

```yaml
- run: PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json
- run: npx @kinora/cli upload results.json --project web-app
  if: always()
  env:
    KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
    # git + ci metadata (sha, branch, repo URL, run link) auto-detect from GITHUB_*
```

## License

MIT
