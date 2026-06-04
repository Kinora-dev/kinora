<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/app/AppHeader.vue'
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <div class="min-h-svh bg-background app-grid">
    <AppHeader />
    <main class="mx-auto max-w-7xl px-5 py-8">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>
    <Toaster position="bottom-right" />
  </div>
</template>

<style>
/* Faint control-room grid behind everything. */
.app-grid {
  background-image:
    linear-gradient(to right, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  background-position: center top;
}
</style>
