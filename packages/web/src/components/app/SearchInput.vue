<script setup lang="ts">
import { Input } from '@kinora/ui/input'
import { Search, X } from '@lucide/vue'

defineProps<{ placeholder?: string }>()
const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="relative w-72">
    <Search class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    <Input v-model="model" :placeholder="placeholder" class="h-9 w-full pr-2 pl-8 font-mono text-xs" />
    <!-- bg-background so a long value scrolls cleanly under the button instead of being clipped mid-glyph -->
    <button
      v-if="model"
      type="button"
      aria-label="Clear search"
      class="absolute top-1/2 right-1 flex h-7 -translate-y-1/2 items-center rounded-md bg-background pr-1.5 pl-2 text-muted-foreground transition-colors hover:text-foreground"
      @click="model = ''"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>
