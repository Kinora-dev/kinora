# playback

A clean overview of your Playwright test reports across projects and over time.

Playwright already ships a great HTML report for a single run. `playback` sits one level up: it aggregates many runs (one per day, per project) into a single dashboard so you can see history, trends, and flaky tests at a glance.

It is a **static frontend only**. There is no backend to run. You host two kinds of JSON files anywhere static (S3, GitHub Pages, nginx, a CDN), point the frontend at that URL, and you are done. Anyone can manage their own reports and run their own UI.

## How it works

```
your static host (config.baseUrl)
├─ manifest.json                       # index: projects + per-run summaries (small)
└─ reports/
   ├─ web-app/2026-06-04-run.json       # full per-run report (drill-down)
   └─ checkout/2026-06-04-run.json
```

1. The frontend fetches `manifest.json` first (one small file, all projects + run summaries).
2. The overview and history views render entirely from those summaries.
3. When you open a single run, it lazily fetches that run's full report from `reports/...`.

All payloads are validated with [zod](https://zod.dev) at the fetch boundary, so a malformed file fails loudly instead of corrupting the UI. The contract lives in [`src/contracts/`](src/contracts/).

## The report format

The source of truth is Playwright's built-in **`json` reporter**:

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [["json", { outputFile: "results.json" }]],
});
```

`results.json` is self-contained and machine-readable. The one catch: it inlines attachment bodies (screenshots, traces) as base64, which makes it heavy. `playback` strips those bodies on ingest and keeps only metadata, producing the two lightweight documents above.

Normalization from a raw Playwright report to the playback contract is implemented in [`src/lib/normalize.ts`](src/lib/normalize.ts) (`ingestPlaywrightReport`). The `playback` CLI (below) wraps it: strip bodies, write the run report, upsert the manifest.

Key contract types:

- `Manifest` - `{ schemaVersion, generatedAt, projects: [{ id, name, runs: RunSummary[] }] }`
- `RunSummary` - one row per run: `counts`, `duration`, `startedAt`, optional `git` / `ci`, and `reportPath`
- `RunReport` - the full run: flattened `tests[]`, each with a stable `testKey` so history can follow the same test across runs

## Generate data (CLI)

After a Playwright run produces `results.json`, feed it to the CLI. It strips attachment bodies, writes the run report, and upserts the manifest into one output directory you then serve.

```bash
pnpm ingest results.json --project web-app --name "Web App E2E"
```

This writes `playback-data/manifest.json` and `playback-data/reports/web-app/<date>.json`. Point `config.baseUrl` at wherever you serve that directory.

Options:

```
--project <id>        required, stable slug per Playwright project
--name <name>         display name (defaults to id)
--run <id>            run id (defaults to the report date, YYYY-MM-DD)
--out <dir>           output root (default: playback-data)
--git-sha / --git-branch / --git-message
--ci-provider / --ci-run-url / --ci-run-number
```

Invoke as `pnpm ingest <args>` (no `--` separator), `npx tsx cli/playback.ts <args>`, or `playback <args>` once installed. Run it once per project per run; re-running the same `--run` replaces that entry. CI example:

```bash
pnpm ingest results.json \
  --project web-app --name "Web App E2E" \
  --run "$GITHUB_RUN_ID" \
  --git-sha "$GITHUB_SHA" --git-branch "${GITHUB_REF_NAME}" \
  --ci-provider github --ci-run-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
# then upload ./playback-data/** to your static host
```

## Configuration

Edit `public/config.js` (shipped to the build output, **no rebuild needed**):

```js
window.__PLAYBACK__ = {
  baseUrl: "https://reports.example.com", // where manifest.json + reports/ live
  title: "Playback",
};
```

Or at build time via `.env`:

```
VITE_PLAYBACK_BASE_URL=https://reports.example.com
```

With an empty `baseUrl` in dev, the app serves built-in **mock data** so you can develop the UI without any server.
