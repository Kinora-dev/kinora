# @kinora/cli

CLI that uploads a Playwright `json` report to a [kinora](https://github.com/joris-gallot/kinora) server. Use it when you can't run the [`@kinora/reporter`](https://github.com/joris-gallot/kinora/tree/main/packages/reporter) inline (e.g. results are produced in one CI job and uploaded from another), or to bulk-import a backlog of historical reports.

## Upload a single report

Produce `results.json` with Playwright's built-in json reporter:

```ts
// playwright.config.ts
reporter: [['json', { outputFile: 'results.json' }]]
```

Then upload it:

```bash
# hosted cloud: token only, the URL defaults to the kinora cloud
npx @kinora/cli upload results.json --project web-app --token <project-token>

# self-host: point at your own server
npx @kinora/cli upload results.json --project web-app \
  --url https://kinora.example.com --token <project-token>
```

Create a project API token in the kinora dashboard (Settings → API tokens). Auth can also come from the environment: `KINORA_TOKEN` and `KINORA_URL`.

## Bulk import (historical backfill)

Import every `*.json` report under a directory in one go - useful for seeding history from an existing archive. Imported runs are capped and metered like normal, but skip alerts (no notification spam), and traces are not uploaded.

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
--ci-provider <name>
--ci-run-url <url>
--ci-run-number <n>
--concurrency <n>     parallel uploads for bulk import (default: 6)
-h, --help
```

## CI example (GitHub Actions)

```yaml
- run: npx playwright test --reporter=json --output=results.json
- run: npx @kinora/cli upload results.json --project web-app
  if: always()
  env:
    KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
    # KINORA_URL only when self-hosting
```

See the [main README](https://github.com/joris-gallot/kinora#readme) for the full workflow, the reporter, and self-hosting.
