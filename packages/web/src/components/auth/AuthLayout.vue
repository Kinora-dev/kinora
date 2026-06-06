<script setup lang="ts">
defineProps<{ tag: string }>()
</script>

<template>
  <div class="relative grid min-h-svh place-items-center overflow-hidden bg-background app-grid px-4">
    <!-- signal glow bleeding from the top -->
    <div
      class="pointer-events-none absolute -top-1/3 left-1/2 size-[44rem] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
      style="background: radial-gradient(circle, var(--signal), transparent 70%)"
      aria-hidden="true"
    />

    <div class="relative w-full max-w-sm">
      <!-- wordmark -->
      <div class="mb-7 flex flex-col items-center gap-2.5 text-center">
        <div class="flex items-center gap-2.5">
          <span
            class="size-2.5 rounded-full bg-signal"
            style="animation: rec-pulse 2s ease-in-out infinite"
            aria-hidden="true"
          />
          <span class="font-mono text-xl font-semibold tracking-tight lowercase">kinora</span>
        </div>
        <p class="font-mono text-[10px] font-medium tracking-[0.25em] text-muted-foreground uppercase">
          {{ tag }}
        </p>
      </div>

      <div class="rounded-xl border border-border bg-card/60 p-6 shadow-xl backdrop-blur-sm">
        <slot />
      </div>

      <p class="mt-5 text-center text-sm text-muted-foreground">
        <slot name="footer" />
      </p>
    </div>
  </div>
</template>
