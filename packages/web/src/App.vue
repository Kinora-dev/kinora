<script setup lang="ts">
import { Toaster } from '@kinora/ui/sonner'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/app/AppHeader.vue'
import LoadingScreen from '@/components/app/LoadingScreen.vue'
import { session } from '@/lib/session'
import 'vue-sonner/style.css'

const ready = session.ready
</script>

<template>
  <LoadingScreen v-if="!ready" />
  <template v-else>
    <RouterView v-slot="{ Component, route }">
      <!-- Public pages (login / signup) render standalone, no app chrome. -->
      <Transition v-if="route.meta.public" name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
      <!-- App pages get the header + control-room grid shell. -->
      <div v-else class="min-h-svh bg-background app-grid">
        <AppHeader />
        <main class="mx-auto max-w-7xl px-5 py-8">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </main>
      </div>
    </RouterView>
    <Toaster position="bottom-right" />
  </template>
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
