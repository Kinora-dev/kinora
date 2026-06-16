<script setup lang="ts">
import { Button } from '@kinora/ui/button'

defineProps<{ serverUrl: string }>()
defineEmits<{ openTrace: [], logout: [] }>()
</script>

<template>
  <header class="sticky top-0 z-30 shrink-0 border-b border-border/80 bg-background/80 backdrop-blur-md">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-5">
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-[15px] font-semibold tracking-tight lowercase">kinora</span>
        <span class="font-mono text-[11px] text-muted-foreground">desktop</span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <span class="hidden font-mono text-xs text-muted-foreground sm:inline">{{ serverUrl }}</span>
        <Button variant="outline" size="sm" class="h-8 font-mono text-xs" @click="$emit('openTrace')">
          Open trace
        </Button>
        <Button variant="ghost" size="sm" class="h-8 font-mono text-xs" @click="$emit('logout')">
          Sign out
        </Button>
      </div>
    </div>
  </header>
</template>
