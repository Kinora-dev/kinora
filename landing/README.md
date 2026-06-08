# kinora landing

Marketing site for kinora. Astro + Tailwind v4, static output. Uses kinora's own
design tokens (mirrored from `@kinora/ui`), wordmark, and real dashboard screenshots.

## Standalone, not a workspace member

The repo's `pnpm-workspace.yaml` only globs `packages/*`, so this project is intentionally
outside the workspace and carries its own lockfile. Install and run with `--ignore-workspace`:

```bash
pnpm install --ignore-workspace
pnpm dev        # http://localhost:4321
pnpm build      # static output -> dist/
pnpm preview
pnpm typecheck  # astro check
```

## Content

- Sections live in `src/components/*`, assembled in `src/pages/index.astro`.
- Copy and links are in `src/lib/site.ts`.
- Screenshots in `src/assets/screenshots/` are copied from `../docs/screenshots`
  (light + dark, swapped by the `.dark` class).

## TODO

- `public/og-image.png` (1200x630) is referenced in `Layout.astro` but not yet added.
- Analytics (umami) is deferred.
