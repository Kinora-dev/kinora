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

1. `src/sw/traceLoaderBackends.ts` - `entry.getData` cast to `zip.FileEntry`
   (zip.js >=2.8 split `Entry` into `FileEntry | DirectoryEntry`).
2. `src/core/protocol/channels.ts` - hand-written minimal type stub instead of
   the full upstream `@protocol/channels` (which pulls the whole protocol).

## License

Vendored files keep their original Apache-2.0 headers (Copyright Microsoft
Corporation). New code under `src/ui/` is MIT, matching the rest of playback.

