<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { ArrowLeft, LayoutGrid } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// router.back() is a no-op on a fresh tab; fall back to the overview.
function goBack(): void {
  if (window.history.length > 1)
    router.back()
  else
    router.push({ name: 'overview' })
}
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
    <span class="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      Route not found
    </span>

    <h1 class="relative mt-6 font-mono text-[7rem] leading-none font-bold tracking-tighter text-foreground/85 select-none sm:text-[9rem]">
      404
      <span
        class="pointer-events-none absolute inset-0 text-muted-foreground/15 blur-[2px]"
        aria-hidden="true"
      >404</span>
    </h1>

    <h2 class="mt-4 text-xl font-semibold tracking-tight">
      This path never reported in
    </h2>
    <p class="mt-1.5 max-w-md text-sm text-muted-foreground">
      No project, run, or trace lives at this address. It may have been removed, or the link was mistyped.
    </p>

    <div class="mt-7 w-full max-w-md overflow-hidden rounded-lg border border-border bg-background/60 text-left">
      <div class="border-b border-border/80 px-4 py-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        assertion failed
      </div>
      <pre class="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground"><span class="text-fail">✕</span> expect(route).toResolve()
<span class="text-muted-foreground/60">  received:</span> <span class="text-foreground">{{ route.fullPath }}</span>
<span class="text-muted-foreground/60">  reason: </span> no matching route</pre>
    </div>

    <div class="mt-8 flex flex-wrap items-center justify-center gap-2.5">
      <Button as-child size="sm" class="font-mono text-xs">
        <RouterLink :to="{ name: 'overview' }">
          <LayoutGrid class="size-3.5" />
          Back to overview
        </RouterLink>
      </Button>
      <Button variant="ghost" size="sm" class="font-mono text-xs" @click="goBack">
        <ArrowLeft class="size-3.5" />
        Go back
      </Button>
    </div>
  </div>
</template>
