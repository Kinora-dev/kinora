<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Loader2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { authClient } from '@/lib/auth'

const props = defineProps<{ invitationId: string }>()
const router = useRouter()

const status = ref<'pending' | 'error'>('pending')
const message = ref('')

onMounted(async () => {
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
