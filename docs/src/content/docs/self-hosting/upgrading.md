---
title: Upgrading & backups
description: Pull the latest kinora, rebuild the stack, and back up your data volumes.
---

## Upgrading

```bash
git pull
docker compose up -d --build
```

Migrations apply automatically on start (the one-shot `migrate` service runs before the server).
There is no separate migration step to run.

If you changed `PUBLIC_URL`, rebuild the web image specifically, since it is baked at build time:

```bash
docker compose up -d --build web
```

## Backups

Two named volumes hold all state:

- `kinora-db` - the Postgres database (projects, runs, tests, users).
- `kinora-artifacts` - uploaded `trace.zip`, screenshots, and videos (when using local storage;
  with an [S3 store](/self-hosting/storage/) the artifacts live in your bucket instead).

Back them up with your usual volume backup workflow, or `pg_dump` for the database:

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > kinora-backup.sql
```

Restore by piping a dump back into `psql` on a fresh database, then bring the stack up.
