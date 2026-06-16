<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Card, CardContent } from '@kinora/ui/card'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { authClient } from '@/lib/auth'

const route = useRoute()
const userCode = (route.query.user_code as string | undefined) ?? ''
const status = ref<'idle' | 'approved' | 'denied' | 'error'>('idle')
const busy = ref(false)
const error = ref('')

async function approve(): Promise<void> {
  busy.value = true
  error.value = ''
  const { error: e } = await authClient.device.approve({ userCode })
  busy.value = false
  if (e)
    error.value = e.error_description ?? 'Failed to approve device'
  else
    status.value = 'approved'
}

async function deny(): Promise<void> {
  busy.value = true
  await authClient.device.deny({ userCode })
  busy.value = false
  status.value = 'denied'
}

// Claim the code for this signed-in session (required before approve/deny).
onMounted(async () => {
  if (!userCode)
    return
  const { error: e } = await authClient.device({ query: { user_code: userCode } })
  if (e) {
    error.value = e.error_description ?? 'Invalid or expired device code'
    status.value = 'error'
  }
})
</script>

<template>
  <div class="flex min-h-[70vh] flex-col items-center justify-center gap-7">
    <div class="flex flex-col items-center gap-2 text-center">
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-xl font-semibold tracking-tight lowercase">kinora</span>
      </div>
      <p class="font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Authorize device
      </p>
    </div>

    <Card class="w-full max-w-sm">
      <CardContent>
        <div v-if="!userCode" class="text-center text-sm text-fail">
          Missing device code.
        </div>
        <div v-else-if="status === 'approved'" class="space-y-1.5 text-center">
          <p class="text-sm font-medium text-pass">
            Device approved
          </p>
          <p class="text-xs text-muted-foreground">
            You can return to the kinora app.
          </p>
        </div>
        <div v-else-if="status === 'denied'" class="text-center text-sm text-muted-foreground">
          Device request denied.
        </div>
        <div v-else-if="status === 'error'" class="text-center text-sm text-fail">
          {{ error }}
        </div>
        <div v-else class="space-y-5">
          <div class="space-y-2 text-center">
            <p class="text-sm text-muted-foreground">
              A device wants to sign in to your kinora account. Confirm this code matches the one shown in the app.
            </p>
            <p class="font-mono text-2xl font-semibold tracking-[0.3em]">
              {{ userCode }}
            </p>
          </div>
          <p v-if="error" class="rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-xs text-fail">
            {{ error }}
          </p>
          <div class="flex gap-2">
            <Button :disabled="busy" class="flex-1 bg-signal text-white hover:bg-signal/90" @click="approve">
              Approve
            </Button>
            <Button :disabled="busy" variant="outline" class="flex-1" @click="deny">
              Deny
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
