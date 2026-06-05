# @playbackhq/trace-viewer

Playwright trace replay engine, vendored from
[microsoft/playwright](https://github.com/microsoft/playwright) (Apache-2.0),
plus playback's own UI on top.

## Layout

- `src/core/` - **vendored** engine. Do not hand-edit beyond import/version fixups.
  - `trace/` - trace file format types (`@trace/src`)
  - `isomorphic/` - snapshot engine + trace model + helpers (`@isomorphic/*`)
  - `protocol/channels.ts` - minimal hand-written subset of `@protocol/channels`
    (only the types the engine references; not vendored verbatim)
- `src/sw/` - **vendored** service worker that serves trace resources into the
  snapshot iframe (`trace-viewer/src/sw`)
- `src/ui/` - **ours**. The Vue UI (to build). This is the part we own.

The `@trace` / `@isomorphic` / `@protocol` path aliases in `tsconfig.json` mirror
upstream so the vendored files compile unedited and re-syncing stays a plain re-copy.

## Local fixups (deltas from upstream)

Keep this list short; every entry is a re-sync cost.

1. `src/core/protocol/channels.ts` - hand-written minimal type stub instead of
   the full upstream `@protocol/channels` (which pulls the whole protocol).

The vendored files themselves are unedited. `@zip.js/zip.js` is pinned to the
exact version Playwright ships (`2.7.29`): newer 2.8.x dropped the
`lib/zip-no-worker-inflate.js` subpath the service worker imports and split the
`Entry` type, both of which would force edits to vendored files. Pinning keeps
them pristine.

## Browser harness

`index.html` + `src/main.ts` register the service worker
(`vite.sw.config.ts` bundles `src/sw-main.ts` to `public/sw.bundle.js`), load a
trace from `public/fixtures/`, and render one DOM snapshot in an iframe. Run
`pnpm dev`. This is a throwaway proof; the real Vue UI replaces `src/main.ts`.

## License

Vendored files keep their original Apache-2.0 headers (Copyright Microsoft
Corporation). New code under `src/ui/` is MIT, matching the rest of playback.

