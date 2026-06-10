<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@kinora/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@kinora/ui/dropdown-menu'
import { Check, ChevronsUpDown, LogOut, Settings } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useOrg } from '@/composables/useOrg'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const router = useRouter()
const user = session.user

const { orgs, org, setActive } = useOrg()
const activeOrgId = computed(() => org.value?.id)
const activeOrgName = computed(() => org.value?.name ?? 'Workspace')

const initial = computed(() => (user.value?.name || user.value?.email || '?').charAt(0).toUpperCase())

async function signOut(): Promise<void> {
  await authClient.signOut()
  session.setUser(null)
  router.push({ name: 'login' })
}
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
          kinora
        </span>
      </RouterLink>

      <div class="ml-auto flex items-center gap-2">
        <!-- Active workspace: always visible so it's clear which org's data is shown. -->
        <DropdownMenu v-if="org">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <span class="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              <span class="max-w-40 truncate">{{ activeOrgName }}</span>
              <ChevronsUpDown class="size-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              Workspaces
            </DropdownMenuLabel>
            <DropdownMenuItem v-for="o in orgs" :key="o.id" class="gap-2" @click="setActive(o.id)">
              <Check class="size-4 shrink-0" :class="o.id === activeOrgId ? 'opacity-100 text-signal' : 'opacity-0'" />
              <span class="truncate">{{ o.name }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu v-if="user">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="rounded-full ring-1 ring-signal/30 transition-shadow hover:ring-signal/60"
              :title="user.name ?? user.email"
            >
              <Avatar class="size-8">
                <AvatarImage v-if="user.image" :src="user.image" :alt="user.name ?? user.email" />
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
            <DropdownMenuItem as-child>
              <RouterLink :to="{ name: 'settings' }">
                <Settings class="size-4" />
                Settings
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem @click="signOut">
              <LogOut class="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
