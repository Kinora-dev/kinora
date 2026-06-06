# @kinora/cli

CLI that turns a Playwright `json` report into [kinora](https://github.com/joris-gallot/kinora) data files. It strips the heavy base64 attachment bodies, writes a lightweight per-run report, and upserts a manifest - the two documents the kinora dashboard reads.

## Usage

```bash
npx @kinora/cli results.json --project web-app --name "Web App E2E"
```

Writes `kinora-data/manifest.json` and `kinora-data/reports/<project>/<run>.json`. Host that directory on any static host and point the dashboard's `baseUrl` at it.

Produce `results.json` with Playwright's built-in reporter:

```ts
// playwright.config.ts
reporter: [['json', { outputFile: 'results.json' }]]
```

## Options

```
--project <id>        required, stable slug per Playwright project
--name <name>         display name (defaults to id)
--run <id>            run id (defaults to report date, YYYY-MM-DD)
--out <dir>           output root (default: kinora-data)
--git-sha / --git-branch
--ci-provider / --ci-run-url / --ci-run-number
```

Re-running the same `--run` replaces that entry. See the [main README](https://github.com/joris-gallot/kinora#readme) for the full workflow and CI example.
