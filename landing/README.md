# kinora landing

Marketing site for kinora.

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
