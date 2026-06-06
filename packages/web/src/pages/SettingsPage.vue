<script setup lang="ts">
import type { ColorMode } from '@kinora/ui/theme'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { colorMode } from '@kinora/ui/theme'
import { toTypedSchema } from '@vee-validate/zod'
import { Check, Copy, KeyRound, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

// Social-only users have no password credential: email/password editing is hidden for them.
const hasPassword = computed(() => session.user.value?.hasPassword ?? false)

const themeOptions = [
  { value: 'auto', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

function setTheme(value: ColorMode): void {
  colorMode.value = value
}

// --- Email ---
const { handleSubmit: submitEmail, isSubmitting: emailSubmitting } = useForm({
  validationSchema: toTypedSchema(
    z.object({
      email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    }),
  ),
  initialValues: { email: session.user.value?.email ?? '' },
})

const onEmail = submitEmail(async (values) => {
  if (values.email === session.user.value?.email) {
    toast.info('That is already your email')
    return
  }
  const { error } = await authClient.changeEmail({ newEmail: values.email })
  if (error) {
    toast.error(error.message ?? 'Could not update email')
    return
  }
  await session.refresh()
  toast.success('Email updated')
})

// --- Password ---
const { handleSubmit: submitPassword, isSubmitting: pwSubmitting, resetForm: resetPw } = useForm({
  validationSchema: toTypedSchema(
    z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'At least 8 characters'),
      confirmPassword: z.string().min(1, 'Confirm your password'),
    }).refine(d => d.newPassword === d.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
  ),
})

const onPassword = submitPassword(async (values) => {
  const { error } = await authClient.changePassword({
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
    revokeOtherSessions: true,
  })
  if (error) {
    toast.error(error.message ?? 'Could not change password')
    return
  }
  resetPw()
  toast.success('Password changed')
})

// --- API tokens ---
type ApiKey = NonNullable<Awaited<ReturnType<typeof authClient.apiKey.list>>['data']>['apiKeys'][number]

const tokens = ref<ApiKey[]>([])
const loadingTokens = ref(true)
const newTokenName = ref('')
const creating = ref(false)
const createdKey = ref('') // full token, shown once right after creation
const copied = ref(false)

async function loadTokens(): Promise<void> {
  loadingTokens.value = true
  const { data, error } = await authClient.apiKey.list()
  if (error)
    toast.error('Could not load tokens')
  else
    tokens.value = data?.apiKeys ?? []
  loadingTokens.value = false
}

onMounted(loadTokens)

async function createToken(): Promise<void> {
  const name = newTokenName.value.trim()
  if (!name) {
    toast.error('Name the token first')
    return
  }
  creating.value = true
  const { data, error } = await authClient.apiKey.create({ name })
  creating.value = false
  if (error || !data) {
    toast.error(error?.message ?? 'Could not create token')
    return
  }
  createdKey.value = data.key
  newTokenName.value = ''
  await loadTokens()
}

async function copyKey(): Promise<void> {
  try {
    await navigator.clipboard.writeText(createdKey.value)
    copied.value = true
    toast.success('Token copied')
    setTimeout(() => (copied.value = false), 1500)
  }
  catch {
    toast.error('Could not copy token')
  }
}

async function deleteToken(id: string): Promise<void> {
  const { error } = await authClient.apiKey.delete({ keyId: id })
  if (error) {
    toast.error('Could not delete token')
    return
  }
  toast.success('Token deleted')
  await loadTokens()
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d)
    return '-'
  return new Date(d).toLocaleDateString()
}
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Settings
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Appearance, account, and API tokens for pushing reports from CI.
      </p>
    </div>

    <!-- Appearance -->
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Theme is stored locally and shared with the trace viewer.</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex gap-2">
          <Button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            variant="outline"
            size="sm"
            class="font-mono text-xs"
            :class="colorMode === opt.value ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
            @click="setTheme(opt.value)"
          >
            <component :is="opt.icon" class="size-3.5" />
            {{ opt.label }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Email -->
    <Card v-if="hasPassword">
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>The address you sign in with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit="onEmail">
          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel :class="labelClass">
                Email
              </FormLabel>
              <FormControl>
                <Input type="email" autocomplete="email" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <Button type="submit" :disabled="emailSubmitting" size="sm" class="self-start font-mono text-xs">
            {{ emailSubmitting ? 'Saving…' : 'Update email' }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <!-- Password -->
    <Card v-if="hasPassword">
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing it signs out your other sessions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit="onPassword">
          <FormField v-slot="{ componentField }" name="currentPassword">
            <FormItem>
              <FormLabel :class="labelClass">
                Current password
              </FormLabel>
              <FormControl>
                <Input type="password" autocomplete="current-password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="newPassword">
            <FormItem>
              <FormLabel :class="labelClass">
                New password
              </FormLabel>
              <FormControl>
                <Input type="password" autocomplete="new-password" placeholder="at least 8 characters" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="confirmPassword">
            <FormItem>
              <FormLabel :class="labelClass">
                Confirm new password
              </FormLabel>
              <FormControl>
                <Input type="password" autocomplete="new-password" placeholder="••••••••" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <Button type="submit" :disabled="pwSubmitting" size="sm" class="self-start font-mono text-xs">
            {{ pwSubmitting ? 'Saving…' : 'Change password' }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <!-- API tokens -->
    <Card>
      <CardHeader>
        <CardTitle>API tokens</CardTitle>
        <CardDescription>Used as a Bearer token to push reports from the reporter or CLI.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-5">
        <!-- One-time reveal of a freshly created token -->
        <div
          v-if="createdKey"
          class="flex flex-col gap-2 rounded-md border border-signal/30 bg-signal/5 px-4 py-3"
        >
          <p class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            Copy now - it will not be shown again
          </p>
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">{{ createdKey }}</code>
            <Button type="button" variant="outline" size="sm" class="shrink-0 font-mono text-xs" @click="copyKey">
              <component :is="copied ? Check : Copy" class="size-3.5" />
              {{ copied ? 'Copied' : 'Copy' }}
            </Button>
          </div>
        </div>

        <!-- Create -->
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-1.5">
            <label class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase" for="token-name">
              New token name
            </label>
            <Input id="token-name" v-model="newTokenName" placeholder="ci-github-actions" @keydown.enter.prevent="createToken" />
          </div>
          <Button type="button" :disabled="creating" size="sm" class="font-mono text-xs" @click="createToken">
            <Plus class="size-3.5" />
            {{ creating ? 'Creating…' : 'Create' }}
          </Button>
        </div>

        <!-- List -->
        <div v-if="loadingTokens" class="py-4 text-center font-mono text-xs text-muted-foreground">
          Loading…
        </div>
        <div v-else-if="!tokens.length" class="py-4 text-center font-mono text-xs text-muted-foreground">
          No tokens yet.
        </div>
        <ul v-else class="flex flex-col divide-y divide-border/70">
          <li v-for="token in tokens" :key="token.id" class="flex items-center gap-3 py-2.5">
            <KeyRound class="size-4 shrink-0 text-muted-foreground" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ token.name ?? 'Unnamed' }}
              </p>
              <p class="font-mono text-[11px] text-muted-foreground">
                {{ token.start }}... · created {{ fmtDate(token.createdAt) }}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8 shrink-0 text-muted-foreground hover:text-fail"
              aria-label="Delete token"
              @click="deleteToken(token.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
