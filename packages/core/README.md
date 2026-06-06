# @kinora/core

Contracts (zod schemas) and helpers for [kinora](https://github.com/joris-gallot/kinora), a dashboard for Playwright reports across projects and over time.

Install this to build a `rest` data source the dashboard can read, or to consume kinora data with types. It also backs the [`@kinora/cli`](https://www.npmjs.com/package/@kinora/cli) ingest and the frontend.

## Install

```bash
npm i @kinora/core
```

## What's inside

**Contract** - one zod schema per dashboard request, plus inferred types:

| schema | type | endpoint it shapes |
|--------|------|--------------------|
| `manifestSchema` | `Manifest` | `GET /api/manifest` |
| `runReportSchema` | `RunReport` | `GET /api/projects/:id/runs/:runId` |
| `projectHistorySchema` | `ProjectHistory` | `GET /api/projects/:id/tests` |

**Helpers**

- `buildTestHistories(reports)` - fold `RunReport[]` into per-test timelines (the `/tests` response).
- `ingestPlaywrightReport(json)` - turn raw Playwright JSON into a normalized `RunReport` (what the CLI does).
- Aggregation: `passRate`, `runHealth`, `denom`, `trend`, `collectBranches`, `collectTags`, `filterRuns`, `formatDuration`, `formatPct`.

## Build a rest endpoint

Validate every response against the contract so the dashboard always gets what it expects:

```ts
import { buildTestHistories, manifestSchema, runReportSchema } from '@kinora/core'

// GET /api/manifest
app.get('/api/manifest', () => manifestSchema.parse(loadManifest()))

// GET /api/projects/:id/tests  ->  fold run reports into per-test history
app.get('/api/projects/:id/tests', (id) => {
  const reports = loadRuns(id).map(r => runReportSchema.parse(r))
  return { project, histories: buildTestHistories(reports) }
})
```

Full reference server: [`examples/rest-server.ts`](https://github.com/joris-gallot/kinora/blob/main/examples/rest-server.ts). Data source modes: [README](https://github.com/joris-gallot/kinora#data-source-modes).

## License

MIT
