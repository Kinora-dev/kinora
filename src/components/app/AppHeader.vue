<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { isDark, toggleTheme } from '@/composables/useTheme'
import { config, useMock } from '@/config'

const source = computed(() => {
  if (useMock) return { label: 'DEMO', detail: 'mock data' }
  try {
    return { label: 'LIVE', detail: new URL(config.baseUrl).host }
  } catch {
    return { label: 'LIVE', detail: config.baseUrl || 'unset' }
  }
})
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-5">
      <RouterLink :to="{ name: 'overview' }" class="group flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-[15px] font-semibold tracking-tight lowercase">
          playback
        </span>
      </RouterLink>

      <span
        class="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-muted-foreground"
      >
        <span
          class="size-1.5 rounded-full"
          :class="source.label === 'LIVE' ? 'bg-pass' : 'bg-flaky'"
        />
        {{ source.label }}
        <span class="text-muted-foreground/60">/ {{ source.detail }}</span>
      </span>

      <div class="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" class="size-8" @click="toggleTheme()">
          <Moon v-if="!isDark" class="size-4" />
          <Sun v-else class="size-4" />
          <span class="sr-only">Toggle theme</span>
        </Button>
      </div>
    </div>
  </header>
</template>
