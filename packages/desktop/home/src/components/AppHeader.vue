<script setup lang="ts">
import type { ProjectEntry } from '@kinora/core'
import { Button } from '@kinora/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@kinora/ui/dropdown-menu'
import { Check, ChevronsUpDown } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{ serverUrl: string, projects: ProjectEntry[], activeId: string | null }>()
defineEmits<{ select: [id: string], openTrace: [], logout: [] }>()

const active = computed(() => props.projects.find(p => p.id === props.activeId))
</script>

<template>
  <header class="sticky top-0 z-30 shrink-0 border-b border-border/80 bg-background/80 backdrop-blur-md">
    <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-[15px] font-semibold tracking-tight lowercase">kinora</span>
        <span class="font-mono text-[11px] text-muted-foreground">desktop</span>
      </div>

      <DropdownMenu v-if="projects.length">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            <span class="max-w-44 truncate">{{ active?.name ?? 'Select project' }}</span>
            <ChevronsUpDown class="size-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-56">
          <DropdownMenuItem
            v-for="p in projects"
            :key="p.id"
            class="gap-2"
            @click="$emit('select', p.id)"
          >
            <Check class="size-4 shrink-0" :class="p.id === activeId ? 'text-signal opacity-100' : 'opacity-0'" />
            <span class="truncate">{{ p.name }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
