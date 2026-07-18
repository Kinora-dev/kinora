---
title: Storage & artifacts
description: 'Where kinora stores trace.zip artifacts: a local volume by default, or any S3-compatible store.'
---

kinora stores binary artifacts (`trace.zip`, screenshots, videos) through a storage interface
with two backends. Test metadata always lives in Postgres; this page is only about the binary
artifacts.

## Local volume (default)

With the `S3_*` variables empty, artifacts are written to a local directory, mounted as the
`kinora-artifacts` named volume in the self-host compose. This is the zero-config default and
keeps everything on your box.

Back it up like any Docker volume - see [Upgrading & backups](/self-hosting/upgrading/).

## S3-compatible store

Set **all five** `S3_*` variables to store artifacts in any S3-compatible object store instead
of the local volume. Works with AWS S3, Cloudflare R2, MinIO, and Hetzner Object Storage.

```bash
S3_ENDPOINT=https://s3.example.com
S3_REGION=auto
S3_BUCKET=kinora-artifacts
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

If any of the five is missing, kinora falls back to the local volume.

### CORS

The dashboard's embedded trace viewer fetches `trace.zip` from the artifact URL via a service
worker, so a bucket serving artifacts to browsers needs CORS to allow `GET` (and the `Range`
header) from your `PUBLIC_URL` origin. Configure this on the bucket, once, in your object
store's settings.
