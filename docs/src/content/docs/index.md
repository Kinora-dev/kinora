---
title: kinora documentation
description: A dashboard for Playwright test reports across projects and over time, with an embedded trace viewer.
---

Playwright ships a great HTML report for a single run on one machine. kinora sits one level up:
it ingests every run from CI, keeps the history, and lets you compare runs, watch pass-rate
trends, and surface flaky tests over time. The Playwright trace viewer is embedded directly in
the dashboard, so a red test is one click from its full trace.

## How it flows

A result travels: **Playwright run → reporter or CLI → kinora server → dashboard**, with the
`trace.zip` on a parallel path. Both upload paths derive the same cross-run test identity, so a
test keeps stable history regardless of how it was pushed. The ingest API is plain REST authed by
an API key, so any CI provider or a `curl` command works.

## Run it two ways

- **Cloud** - sign up at [app.kinora.dev](https://app.kinora.dev). Free tier, no infrastructure
  to run. Start with [Getting started](/getting-started/).
- **Self-host** - one `docker compose` for the whole stack, single origin, your data stays on
  your box. See [Self-hosting](/self-hosting/).

## Where to next

- [Getting started](/getting-started/): create a project, add the reporter, see your first run.
- [Guides](/guides/reporter/): reporter, CLI, PR comments, alerts, MCP, desktop.
- [Self-hosting](/self-hosting/): run the whole stack with Docker Compose.
- [Live demo](https://demo.kinora.dev): the dashboard with seeded data, no sign-up.
