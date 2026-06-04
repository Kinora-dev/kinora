# @playbackhq/cli

CLI that turns a Playwright `json` report into [playback](https://github.com/joris-gallot/playback) data files. It strips the heavy base64 attachment bodies, writes a lightweight per-run report, and upserts a manifest - the two documents the playback dashboard reads.

## Usage

```bash
npx @playbackhq/cli results.json --project web-app --name "Web App E2E"
```

Writes `playback-data/manifest.json` and `playback-data/reports/<project>/<run>.json`. Host that directory on any static host and point the dashboard's `baseUrl` at it.

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
--out <dir>           output root (default: playback-data)
--git-sha / --git-branch
--ci-provider / --ci-run-url / --ci-run-number
```

Re-running the same `--run` replaces that entry. See the [main README](https://github.com/joris-gallot/playback#readme) for the full workflow and CI example.
