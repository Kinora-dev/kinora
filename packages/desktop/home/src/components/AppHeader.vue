<script setup lang="ts">
import type { ProjectEntry } from '@kinora/core'
import type { SessionUser } from '../../src/bridge'
import { Avatar, AvatarFallback, AvatarImage } from '@kinora/ui/avatar'
import { Button } from '@kinora/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@kinora/ui/dropdown-menu'
import { Check, ChevronsUpDown, ExternalLink, LogOut, Settings } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{ projects: ProjectEntry[], activeId: string | null, user: SessionUser | null }>()
defineEmits<{ select: [id: string], openTrace: [], logout: [], openAccount: [] }>()

const active = computed(() => props.projects.find(p => p.id === props.activeId))
const initial = computed(() => (props.user?.name || props.user?.email || '?').charAt(0).toUpperCase())
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
        <Button variant="outline" size="sm" class="h-8 font-mono text-xs" @click="$emit('openTrace')">
          Open trace
        </Button>
        <DropdownMenu v-if="user">
          <DropdownMenuTrigger as-child>
            <button type="button" class="rounded-full ring-1 ring-signal/30 transition-shadow hover:ring-signal/60" :title="user.name || user.email">
              <Avatar class="size-8">
                <AvatarImage v-if="user.image" :src="user.image" :alt="user.name" />
                <AvatarFallback v-else class="bg-signal/15 text-xs font-semibold text-signal">
                  {{ initial }}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>
              <div class="flex min-w-0 flex-col">
                <span v-if="user.name && user.name !== user.email" class="truncate text-sm font-medium">{{ user.name }}</span>
                <span class="truncate text-xs font-normal text-muted-foreground">{{ user.email }}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="$emit('openAccount')">
              <Settings class="size-4" />
              Account settings
              <ExternalLink class="ml-auto size-3 opacity-60" />
            </DropdownMenuItem>
            <DropdownMenuItem @click="$emit('logout')">
              <LogOut class="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
