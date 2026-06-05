<script setup lang="ts">
import type { ColorMode } from '@/composables/useTheme'
import { Button } from '@playbackhq/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@playbackhq/ui/dropdown-menu'
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { computed } from 'vue'
import { colorMode } from '@/composables/useTheme'

const options = [
  { value: 'auto', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

const activeIcon = computed(
  () => options.find(o => o.value === colorMode.value)?.icon ?? Monitor,
)

function setMode(value: ColorMode) {
  colorMode.value = value
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="Theme">
        <component :is="activeIcon" class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-40 font-mono">
      <DropdownMenuLabel class="text-[10px] uppercase tracking-wider text-muted-foreground">
        Theme
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        :model-value="colorMode"
        @update:model-value="(v) => setMode(v as ColorMode)"
      >
        <DropdownMenuRadioItem
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
          class="gap-2 text-[11px] uppercase tracking-wider"
          :class="colorMode === opt.value ? 'text-foreground' : 'text-muted-foreground'"
        >
          <template #indicator-icon>
            <span class="size-1.5 rounded-full bg-signal" />
          </template>
          <component :is="opt.icon" class="size-3.5" />
          {{ opt.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
