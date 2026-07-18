---
title: Self-hosting kinora
description: Run the whole stack (Postgres + server + dashboard) with one docker compose, on a single origin.
---

Self-host runs the whole stack (Postgres + server + dashboard) with one `docker compose`, on a
single origin, with trace artifacts on a local volume. It runs with `KINORA_CLOUD=false`: no
billing, and every feature (including alerts) is unlimited.

## Quickstart

From the [`selfhost/`](https://github.com/Kinora-dev/kinora/tree/main/selfhost) directory of the
repo:

```bash
cp .env.example .env
# edit at least: PUBLIC_URL, AUTH_SECRET, POSTGRES_PASSWORD
docker compose up -d --build
```

Open `PUBLIC_URL` (default `http://localhost:8080`) and create your account. The first user owns
their workspace; invite teammates from Settings.

## What's in the bundle

- `docker-compose.yml` - Postgres, a one-shot migrate, the server, and the web container.
- `nginx.conf` - the web container's reverse proxy: serves the dashboard + trace viewer and
  proxies the API to the server.
- `.env.example` - all configuration.

Images are built from the repo root via the per-package Dockerfiles; the compose `build.context`
is `..`.

## How it works

Everything is **one origin**. The web container serves the dashboard and the embedded trace
viewer, and reverse-proxies `/api`, `/trpc`, and `/artifacts` to the server. So there is no CORS
to configure and the session cookie stays host-only (`COOKIE_DOMAIN` empty). Postgres data and
trace artifacts live in named volumes (`kinora-db`, `kinora-artifacts`). Migrations run
automatically (the `migrate` service) before the server starts.

## Send your tests

Point the reporter or CLI at your `PUBLIC_URL`:

```bash
# reporter (in playwright.config.ts:
#   reporter: [['@kinora/reporter', { project: { slug: 'web-app' } }]])
KINORA_URL=https://kinora.example.com KINORA_TOKEN=<token> npx playwright test

# CLI
npx @kinora/cli upload results.json --project web-app \
  --url https://kinora.example.com --token <token>
```

Create the token in the dashboard under **Settings → Workspace**. See
[Getting started](/getting-started/) for the full setup.

## Custom domain and HTTPS

Set `PUBLIC_URL` to your public https URL (e.g. `https://kinora.example.com`) and put the web
container behind your own TLS proxy (Caddy, Traefik, nginx, a load balancer) forwarding to
`WEB_PORT`. `PUBLIC_URL` is baked into the web image at build time, so rebuild after changing it:

```bash
docker compose up -d --build web
```

## Next

- [Configuration](/self-hosting/configuration/): every `.env` variable.
- [Storage & artifacts](/self-hosting/storage/): local volume vs S3-compatible store.
- [Upgrading & backups](/self-hosting/upgrading/): pull, rebuild, and back up your volumes.
