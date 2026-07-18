---
title: REST API
section: Reference
description: The plain-REST ingest and read API, authed by an API key. What the reporter, CLI, and MCP server call.
---

kinora's public API is plain REST, so any CI provider, `curl`, or language can push results and
read them back. The [reporter](/guides/reporter/) and [CLI](/guides/cli/) call the ingest
endpoints for you; the [MCP server](/guides/mcp/) calls the read endpoints. Use this reference
when you want a custom integration.

## Base URL

- Cloud: `https://api.kinora.dev`
- Self-host: your server's origin.

## Authentication

Every request needs an API token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Create a token in the dashboard under **Settings → Workspace**. The token is scoped to the
workspace that owns it; all requests read and write only that workspace's data.

Requests are rate-limited per client IP (`INGEST_RATE_LIMIT`, default 600/min).

## Ingest

### POST /api/v1/runs

Upload one normalized run. The project is created automatically the first time its `slug` is seen.
The body is the normalized run JSON that `@kinora/core` produces (the reporter and CLI build it);
its top-level shape:

```json
{
  "project": { "slug": "web-app", "name": "Web App" },
  "run": {
    "startedAt": "2026-07-18T10:00:00.000Z",
    "duration": 42000,
    "counts": { "expected": 120, "unexpected": 2, "flaky": 1, "skipped": 3 },
    "playwrightVersion": "1.50.0",
    "git": { "sha": "…", "branch": "main", "baseBranch": "main", "repoUrl": "…" },
    "ci": { "provider": "github", "runUrl": "…", "runNumber": 42 },
    "shards": null
  },
  "tests": [{ "testKey": "…", "title": "…", "status": "expected", "…": "…" }]
}
```

Query parameters:

| Param | Effect |
| --- | --- |
| `backfill=1` | Historical import: suppresses alerts and stays unmetered (billing follows `run.startedAt`). |
| `regression=1` | Compute regression vs the base branch and include it in the response. |

Response `201`:

```json
{ "projectId": "…", "runId": "…", "tests": 126, "runUrl": "https://app.kinora.dev/projects/web-app/runs/…", "regression": { "…": "…" } }
```

`runUrl` is always returned; `regression` only when `regression=1` was passed.

Errors: `401` invalid API key · `402` plan limit reached (cloud free tier) · `413` body over 25 MB.

### POST /api/v1/runs/:runId/artifacts

Upload a `trace.zip` (or other binary) for a run, as `multipart/form-data`. Send the file part
plus a `testKey` field to link it to a test, and an optional `name` field.

Response `201`:

```json
{ "url": "https://…/trace.zip" }
```

Errors: `404` run not found · `400` no file part · `413` file over 100 MB.

## Read

All read routes are `GET`, Bearer-authed, and scoped to your workspace.

### GET /api/v1/projects

Every project with its latest run summary.

```json
{ "projects": [{ "id": "web-app", "name": "Web App", "description": null, "latestRun": { "…": "…" } }] }
```

`id` is the project slug.

### GET /api/v1/projects/:slug/runs

Run summaries, newest first. Query `limit` (default 50, max 200).

```json
{ "runs": [{ "…": "…" }] }
```

### GET /api/v1/projects/:slug/runs/:runId

The full report for one run. Use `latest` as `:runId` for the most recent run. Returns counts,
git/CI metadata, and every test with its status and failures.

### GET /api/v1/projects/:slug/failures

The failing and flaky tests of a run (defaults to the latest). Query `runId` to target a specific
run.

```json
{ "runId": "…", "startedAt": "…", "counts": { "…": "…" }, "failures": [{ "status": "unexpected", "…": "…" }] }
```

### GET /api/v1/projects/:slug/history

Per-test history across the project's runs. Query `testKey` to narrow to one test; omit it for all.

```json
{ "histories": [{ "testKey": "…", "…": "…" }] }
```

## Examples

Upload a run with `curl`:

```bash
curl -X POST https://api.kinora.dev/api/v1/runs \
  -H "Authorization: Bearer $KINORA_TOKEN" \
  -H "Content-Type: application/json" \
  --data @run.json
```

Read the latest run's failures:

```bash
curl https://api.kinora.dev/api/v1/projects/web-app/failures \
  -H "Authorization: Bearer $KINORA_TOKEN"
```
