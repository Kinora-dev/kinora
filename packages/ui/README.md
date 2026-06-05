# @playbackhq/ui

Shared shadcn-vue design system (components + tokens) consumed by `@playbackhq/app`
and `@playbackhq/trace-viewer`.

Consumed **as source** (no build step): the consuming app's Vite/Tailwind processes
the `.vue`/`.ts` files directly.

## What's here

- `src/components/ui/*` - shadcn-vue components (reka-ui based)
- `src/lib/utils.ts` - `cn()` (exported as `@playbackhq/ui` and `@playbackhq/ui/utils`)
- `src/theme.css` - design tokens, `@theme`, base layer, and `@source` for these
  components. Each consumer imports it after `@import 'tailwindcss'`.

## Consuming

```ts
import { cn } from '@playbackhq/ui'
import { Button } from '@playbackhq/ui/button'
```

```css
@import 'tailwindcss';
@import '@playbackhq/ui/theme.css';
```

## Adding components

`pnpm dlx shadcn-vue@latest add <name>` writes to `src/components/ui/<name>`.

**Important:** because the package is consumed as source, components must use
**relative imports**, not the `@/` alias. After adding, rewrite generated imports:

```bash
# in packages/ui
grep -rl "@/lib/utils" src/components/ui/<name> \
  | xargs sed -i '' 's#@/lib/utils#../../../lib/utils#g'
```

(Cross-`ui` imports `@/components/ui/x` likewise become relative.) The `@/` alias
in `tsconfig.json` exists only so the CLI and editor resolve types.
