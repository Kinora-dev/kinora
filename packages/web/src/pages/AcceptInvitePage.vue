<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Loader2 } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const props = defineProps<{ invitationId: string }>()
const router = useRouter()
const route = useRoute()

const status = ref<'pending' | 'guest' | 'error'>('pending')
const message = ref('')

// Bring the invitee back to this invite after they authenticate.
const authQuery = computed(() => ({ redirect: route.fullPath }))

onMounted(async () => {
  await session.ensure()
  if (!session.user.value) {
    status.value = 'guest'
    return
  }
  const { data, error } = await authClient.organization.acceptInvitation({ invitationId: props.invitationId })
  if (error || !data) {
    status.value = 'error'
    message.value = error?.message ?? 'This invitation is invalid or has expired.'
    return
  }
  const orgId = data.invitation?.organizationId
  if (orgId)
    await authClient.organization.setActive({ organizationId: orgId })
  router.replace({ name: 'overview' })
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-5">
    <div class="flex max-w-sm flex-col items-center gap-4 text-center">
      <span class="size-2.5 rounded-full bg-signal" style="animation: rec-pulse 2s ease-in-out infinite" aria-hidden="true" />

      <template v-if="status === 'pending'">
        <Loader2 class="size-5 animate-spin text-muted-foreground" />
        <p class="font-mono text-sm text-muted-foreground">
          Joining the workspace…
        </p>
      </template>

      <template v-else-if="status === 'guest'">
        <h1 class="text-lg font-semibold tracking-tight">
          You've been invited to kinora
        </h1>
        <p class="text-sm text-muted-foreground">
          Sign in or create an account to join the workspace.
        </p>
        <div class="flex gap-2">
          <Button as-child size="sm" class="font-mono text-xs">
            <RouterLink :to="{ name: 'signup', query: authQuery }">
              Create account
            </RouterLink>
          </Button>
          <Button as-child variant="outline" size="sm" class="font-mono text-xs">
            <RouterLink :to="{ name: 'login', query: authQuery }">
              Sign in
            </RouterLink>
          </Button>
        </div>
      </template>

      <template v-else>
        <h1 class="text-lg font-semibold tracking-tight">
          Invitation unavailable
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ message }}
        </p>
        <Button as-child variant="outline" size="sm" class="font-mono text-xs">
          <RouterLink :to="{ name: 'overview' }">
            Go to dashboard
          </RouterLink>
        </Button>
      </template>
    </div>
  </div>
</template>
