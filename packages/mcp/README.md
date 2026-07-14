# @kinora/mcp

MCP server that exposes your [kinora](https://kinora.dev) Playwright test data to coding agents (Claude Code, Cursor, Claude Desktop, Windsurf, …). Point an agent at your last CI failures and let it pull the error, the trace, and the flaky-vs-regression history to debug the fix.

## Setup

Add it to your agent's MCP config. It needs a kinora API key (create one in the dashboard under project settings / tokens) and, for self-host, your server URL.

```json
{
  "mcpServers": {
    "kinora": {
      "command": "npx",
      "args": ["-y", "@kinora/mcp"],
      "env": {
        "KINORA_TOKEN": "<your api key>",
        "KINORA_URL": "https://api.kinora.dev"
      }
    }
  }
}
```

`KINORA_URL` defaults to the hosted cloud; set it to your own origin for self-host. Both can also be passed as `--token` / `--url` flags.

## Tools

| Tool            | What it returns                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `list_projects` | Every project with its latest run summary.                                                                                       |
| `list_failures` | Failing/flaky tests of a run (defaults to latest): error, `file:line`, trace URL.                                                |
| `get_run`       | Full report for one run: counts, git/CI metadata, all test statuses, failures.                                                   |
| `test_history`  | Per-test history: pass/fail/flaky rates + `newlyBroken`/`newlyFlaky` flags to tell a fresh regression from a chronic/flaky test. |
| `get_trace`     | The Playwright `trace.zip` URL for one test, to open in the viewer or download.                                                  |

## License

MIT.
