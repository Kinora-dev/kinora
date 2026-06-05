# playback

A dashboard for your Playwright reports, across projects and over time.

Playwright ships a great HTML report for a single run. `playback` sits one level up: it aggregates many runs into one place where you track pass rates, spot trends, and surface flaky tests over time. No backend - it's a static frontend that reads JSON you host anywhere.

It also bundles its own Playwright **trace viewer**: ingest keeps each test's `trace.zip`, and failing tests get a "View trace" button that opens the full DOM/timeline/network debugger - no separate tooling.

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/overview-light.png">
  <img alt="Overview" src="docs/screenshots/overview-dark.png">
</picture>

## Quick start

Try it with built-in demo data:

```bash
pnpm install
pnpm dev:app  # http://localhost:5173 - shows mock data
```

That's the full UI running on sample reports. To plug in your own, see [Set up your own reports](#set-up-your-own-reports).

## Screenshots

<table>
<tr>
<td width="50%"><picture><source media="(prefers-color-scheme: light)" srcset="docs/screenshots/project-light.png"><img alt="Project history" src="docs/screenshots/project-dark.png"></picture><br><sub><b>Project</b> - run history with pass / fail / flaky per run</sub></td>
<td width="50%"><picture><source media="(prefers-color-scheme: light)" srcset="docs/screenshots/tests-light.png"><img alt="Per-test history" src="docs/screenshots/tests-dark.png"></picture><br><sub><b>Tests</b> - per-test flake and fail rates</sub></td>
</tr>
<tr>
<td width="50%"><picture><source media="(prefers-color-scheme: light)" srcset="docs/screenshots/run-light.png"><img alt="Run detail" src="docs/screenshots/run-dark.png"></picture><br><sub><b>Run</b> - every test in one run, filterable</sub></td>
<td width="50%"><picture><source media="(prefers-color-scheme: light)" srcset="docs/screenshots/test-history-light.png"><img alt="Test timeline" src="docs/screenshots/test-history-dark.png"></picture><br><sub><b>Test history</b> - one test across runs, with errors</sub></td>
</tr>
</table>

## Set up your own reports

Produce your data with the CLI, then point the dashboard at it

### 1. Emit Playwright's JSON report

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [['json', { outputFile: 'results.json' }]],
  // enable tracing so "View trace" works (on / retain-on-failure / on-first-retry)
  use: { trace: 'retain-on-failure' },
})
```

### 2. Ingest it with the CLI

`results.json` is heavy (inline attachment bodies). The CLI strips those into a lightweight run report, upserts a manifest, and copies failing tests' `trace.zip` into `artifacts/` so the dashboard can open them in the trace viewer (`--keep all` for every test, `none` to skip):

```bash
npx @playbackhq/cli results.json --project web-app --name "Web App E2E"
```

Output lands in `playback-data/`:

- `manifest.json` - index of projects and runs
- `reports/web-app/<date>.json` - one file per run
- `artifacts/web-app/<run>/<sha>.zip` - copied traces (if any)

Because traces are copied from disk, **run the CLI where Playwright's `test-results/` still exists** (your CI job, before teardown). Point `--results-dir` at it if it isn't `./test-results`. Run once per project per run; re-running the same `--run` replaces that entry. Full flags in [CLI reference](#cli-reference).

### 3. Host the data

Upload `playback-data/**` to any static host (S3, GitHub Pages, nginx, a CDN). The URL where `manifest.json` lives is your `baseUrl` for the next step.

### 4. Run the dashboard

```bash
docker run -p 8080:80 \
  -e PLAYBACK_BASE_URL=https://reports.example.com \
  -e PLAYBACK_TITLE="My Reports" \
  ghcr.io/joris-gallot/playback:latest
```

Dashboard at http://localhost:8080

Defaults to `static` (reads the files you hosted). Outgrowing it? [Data source modes](#data-source-modes) covers the `rest` API.

## CLI reference

```bash
npx @playbackhq/cli <results.json> --project <id> [options]
```

```
--project <id>        required, stable slug per Playwright project
--name <name>         display name (defaults to id)
--run <id>            run id (defaults to report date, YYYY-MM-DD)
--out <dir>           output root (default: playback-data)
--results-dir <dir>   Playwright test-results dir, to resolve trace.zip (default: test-results)
--keep <policy>       whose traces to copy: failed | all | none (default: failed)
--git-sha / --git-branch
--ci-provider / --ci-run-url / --ci-run-number
```

Run via `npx @playbackhq/cli <args>`, or install it (`npm i -g @playbackhq/cli`) and call `playback <args>`

CI example:

```bash
npx @playbackhq/cli results.json \
  --project web-app --name "Web App E2E" \
  --run "$GITHUB_RUN_ID" \
  --git-sha "$GITHUB_SHA" --git-branch "$GITHUB_REF_NAME" \
  --ci-provider github --ci-run-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
# then upload ./playback-data/** to your static host
```

## Data source modes

The frontend reads data through one small interface, with two transports selected by `mode`: the `PLAYBACK_MODE` env var on Docker. Same contract on both sides, so the UI is identical - only the transport differs.

**`static`** (default) - fetches files, zero backend:

```
GET {baseUrl}/manifest.json
GET {baseUrl}/reports/<project>/<run>.json
```

Per-test history is folded client-side (one fetch per run).

**`rest`** - fetches an API. Use when you outgrow static: huge manifests (paginate server-side), private reports (auth), or to skip downloading every run report just to build history.

```
GET {baseUrl}/api/manifest                           -> Manifest
GET {baseUrl}/api/projects/:projectId/runs/:runId    -> RunReport
GET {baseUrl}/api/projects/:projectId/tests          -> { project, histories }
```

[`examples/rest-server.ts`](examples/rest-server.ts) is a small [Hono](https://hono.dev) server implementing the three endpoints above - run it or use it as a template. Install [`@playbackhq/core`](https://www.npmjs.com/package/@playbackhq/core) for the zod schemas and helpers your responses must satisfy (`manifestSchema`, `runReportSchema`, `projectHistorySchema`, `buildTestHistories`). Then set `PLAYBACK_MODE=rest` to point the dashboard at your API.

## Docker

The published image serves the dashboard and generates `config.js` from env on startup. Basic run is in [step 4](#4-run-the-dashboard); all env vars:

| env | default | meaning |
|-----|---------|---------|
| `PLAYBACK_BASE_URL` | (empty) | where `manifest.json` + `reports/` + `artifacts/` live - **required** for real data |
| `PLAYBACK_MODE` | `static` | `static` (files) or `rest` (`/api/*` endpoints) |
| `PLAYBACK_TITLE` | `Playback` | header title |
| `PLAYBACK_VIEWER_URL` | `/trace/` | where the bundled trace viewer is served |

Build the image yourself instead of pulling:

```bash
docker build -t playback .
docker run -p 8080:80 -e PLAYBACK_BASE_URL=https://reports.example.com playback
```

The bundled nginx serves on port 80, falls back SPA deep links to `index.html`, and marks `config.js` no-cache so a container restart with new env takes effect.

