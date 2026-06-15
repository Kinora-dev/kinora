# @kinora/reporter

Playwright reporter that uploads your test results to a [kinora](https://github.com/joris-gallot/kinora) server: pass rates, trends, flaky tests, and the full Playwright trace for failures, across projects and over time.

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

The token comes from the environment (keep it out of the config file). The server URL defaults to the hosted cloud; set `KINORA_URL` only when self-hosting:

```bash
# hosted cloud
KINORA_TOKEN=<token> npx playwright test

# self-host
KINORA_URL=https://kinora.example.com KINORA_TOKEN=<token> npx playwright test
```

Create an API token in the kinora dashboard (Settings → Workspace).

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
| `git`     | `{ sha?, branch? }`                  | auto on GitHub Actions       | Git metadata for the run.                  |
| `ci`      | `{ provider?, runUrl?, runNumber? }` | auto on GitHub Actions       | CI metadata for the run.                   |

On GitHub Actions, `git` and `ci` are filled from the standard `GITHUB_*` env vars. Pass them explicitly on other CI providers.

## CI example (GitHub Actions)

```yaml
- run: npx playwright test
  env:
    KINORA_URL: ${{ vars.KINORA_URL }}
    KINORA_TOKEN: ${{ secrets.KINORA_TOKEN }}
```

## Notes

- If `KINORA_TOKEN` is missing, the reporter logs a warning and skips the upload, so local runs aren't affected. `KINORA_URL` is optional (defaults to the hosted cloud).
- Traces are uploaded only for tests that produced one, so enable `trace` in your Playwright config (`on-first-retry`, `retain-on-failure`, etc.).
- Cross-run test identity is the file + title path + Playwright project name, so history stays stable as long as those don't change.

## License

MIT
