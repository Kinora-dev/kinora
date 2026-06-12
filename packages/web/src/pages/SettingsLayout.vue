<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const links = [
  { name: 'settings-account', label: 'Account' },
  { name: 'settings-workspace', label: 'Workspace' },
] as const
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-8">
    <h1 class="text-2xl font-semibold tracking-tight">
      Settings
    </h1>

    <div class="flex flex-col gap-8 sm:flex-row sm:gap-10">
      <nav class="flex shrink-0 gap-1 sm:w-40 sm:flex-col">
        <RouterLink
          v-for="l in links"
          :key="l.name"
          :to="{ name: l.name }"
          class="rounded-md px-3 py-1.5 font-mono text-xs tracking-wide transition-colors"
          :class="route.name === l.name ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
        >
          {{ l.label }}
        </RouterLink>
      </nav>

      <div class="min-w-0 flex-1">
        <RouterView />
      </div>
    </div>
  </div>
</template>
