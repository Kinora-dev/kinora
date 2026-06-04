<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/app/AppHeader.vue'
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <div class="min-h-svh bg-background app-grid">
    <AppHeader />
    <main class="mx-auto max-w-7xl px-5 py-8">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
    <Toaster position="bottom-right" />
  </div>
</template>

<style>
/* Quick fade + nudge between routes; out-in so pages don't overlap. */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}

/* Faint control-room grid behind everything. */
.app-grid {
  background-image:
    linear-gradient(to right, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  background-position: center top;
}
</style>
