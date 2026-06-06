<script setup lang="ts">
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@kinora/ui/dropdown-menu'
import { ThemeToggle } from '@kinora/ui/theme-toggle'
import { LogOut } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const router = useRouter()
const user = session.user

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

      <div class="ml-auto flex items-center gap-1.5">
        <ThemeToggle />

        <DropdownMenu v-if="user">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-full bg-signal/15 text-xs font-semibold text-signal ring-1 ring-signal/30 transition-colors hover:ring-signal/60"
              :title="user.name ?? user.email"
            >
              {{ initial }}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>
              <div class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-medium">{{ user.name }}</span>
                <span class="truncate text-xs font-normal text-muted-foreground">{{ user.email }}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
