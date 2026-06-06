<template>
  <div class="grid min-h-svh place-items-center bg-background app-grid">
    <div class="flex flex-col items-center gap-5">
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-xl font-semibold tracking-tight lowercase">kinora</span>
      </div>
      <div class="h-px w-32 overflow-hidden rounded-full bg-border">
        <div class="loading-bar h-full w-1/3 rounded-full bg-signal" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-bar {
  animation: slide 1.1s ease-in-out infinite;
}
@keyframes slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(420%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-bar {
    animation: none;
  }
}
</style>
