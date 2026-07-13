<script setup lang="ts">
import { Badge } from '@kinora/ui/badge'
import { Loader2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import Icon from '@/components/Icon.vue'
import { useServerConfig } from '@/composables/queries'
import { authClient } from '@/lib/auth'

type Provider = 'github' | 'google'

const route = useRoute()
const pending = ref<Provider | null>(null)
const lastMethod = authClient.getLastUsedLoginMethod()

const { state: serverConfig } = useServerConfig()
const githubEnabled = computed(() => serverConfig.value?.githubOauthEnabled ?? false)
const googleEnabled = computed(() => serverConfig.value?.googleOauthEnabled ?? false)
const anyEnabled = computed(() => githubEnabled.value || googleEnabled.value)

async function signIn(provider: Provider): Promise<void> {
  pending.value = provider
  // Honor ?redirect= (e.g. /device?user_code=…) so OAuth returns there, not the overview.
  const r = route.query.redirect
  const callbackURL = typeof r === 'string' && r.startsWith('/') ? `${window.location.origin}${r}` : window.location.origin
  const { error } = await authClient.signIn.social({ provider, callbackURL })
  if (error) {
    toast.error(error.message ?? `Could not sign in with ${provider}`)
    pending.value = null
  }
}
</script>

<template>
  <div v-if="anyEnabled" class="flex flex-col gap-2.5">
    <button
      v-if="githubEnabled"
      type="button"
      :disabled="!!pending"
      class="group relative flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-background/40 px-4 py-2.5 font-mono text-[11px] tracking-wider text-foreground uppercase transition-colors hover:border-signal/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
      @click="signIn('github')"
    >
      <Loader2 v-if="pending === 'github'" class="size-4 animate-spin" />
      <Icon v-else name="github" class="size-4" />
      Continue with GitHub
      <Badge v-if="lastMethod === 'github'" class="absolute -top-2 -right-2 border-signal/30 bg-signal px-1.5 py-0.5 text-[9px] leading-none tracking-wider text-white shadow-sm">
        Last used
      </Badge>
    </button>

    <button
      v-if="googleEnabled"
      type="button"
      :disabled="!!pending"
      class="group relative flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-background/40 px-4 py-2.5 font-mono text-[11px] tracking-wider text-foreground uppercase transition-colors hover:border-signal/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
      @click="signIn('google')"
    >
      <Loader2 v-if="pending === 'google'" class="size-4 animate-spin" />
      <Icon v-else name="google" class="size-4" />
      Continue with Google
      <Badge v-if="lastMethod === 'google'" class="absolute -top-2 -right-2 border-signal/30 bg-signal px-1.5 py-0.5 text-[9px] leading-none tracking-wider text-white shadow-sm">
        Last used
      </Badge>
    </button>

    <div class="my-2 flex items-center gap-3">
      <div class="h-px flex-1 bg-border" />
      <span class="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">or</span>
      <div class="h-px flex-1 bg-border" />
    </div>
  </div>
</template>
