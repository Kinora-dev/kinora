<script setup lang="ts">
import type { ColorMode } from '@kinora/ui/theme'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { colorMode } from '@kinora/ui/theme'
import { toTypedSchema } from '@vee-validate/zod'
import { ArrowUpRight, Building2, Check, Copy, CreditCard, KeyRound, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import { useApiTokens } from '@/composables/useApiTokens'
import { useBilling } from '@/composables/useBilling'
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

// --- Email (plain ref: a single field, sidesteps the vee-validate/Input prefill binding quirk) ---
const emailInput = ref(session.user.value?.email ?? '')
const emailError = ref('')
const emailSaving = ref(false)
const emailValid = computed(() => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(emailInput.value.trim()))

async function updateEmail(): Promise<void> {
  emailError.value = ''
  const next = emailInput.value.trim()
  if (next === session.user.value?.email) {
    emailError.value = 'That is already your email'
    return
  }
  emailSaving.value = true
  const { error } = await authClient.changeEmail({ newEmail: next })
  emailSaving.value = false
  if (error) {
    emailError.value = error.message ?? 'Could not update email'
    return
  }
  await session.refresh()
  toast.success('Email updated')
}

// --- Password ---
const { handleSubmit: submitPassword, isSubmitting: pwSubmitting, resetForm: resetPw, setFieldError: setPwError, meta: pwMeta } = useForm({
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
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})

const onPassword = submitPassword(async (values) => {
  const { error } = await authClient.changePassword({
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
    revokeOtherSessions: true,
  })
  if (error) {
    setPwError('currentPassword', error.message ?? 'Could not change password')
    return
  }
  resetPw()
  toast.success('Password changed')
})

// --- API tokens ---
const {
  tokens,
  loading: loadingTokens,
  creating,
  createdKey,
  copied,
  create: createApiToken,
  copyCreatedKey: copyKey,
  remove: deleteToken,
} = useApiTokens()

const newTokenName = ref('')

async function createToken(): Promise<void> {
  if (await createApiToken(newTokenName.value))
    newTokenName.value = ''
}

// --- Plan & billing ---
const { summary: billing, refresh: refreshBilling, pending: billingPending, checkout, openPortal } = useBilling()
const route = useRoute()
const router = useRouter()

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  team: 'Team',
  pro: 'Pro',
  enterprise: 'Enterprise',
  selfhost: 'Self-host',
}

const CONTACT_HREF = 'mailto:contact@kinora.dev?subject=kinora%20enterprise'

const isPaid = computed(() => ['team', 'pro', 'enterprise'].includes(billing.value?.tier ?? ''))

const usagePct = computed(() => {
  const b = billing.value
  if (!b || b.includedResults == null)
    return 0
  return Math.min(100, Math.round((b.usedResults / b.includedResults) * 100))
})

const overCap = computed(() => {
  const b = billing.value
  return !!b && b.includedResults != null && b.usedResults >= b.includedResults
})

const upgradeOptions = computed(() => {
  const tier = billing.value?.tier
  if (tier === 'free') {
    return [
      { slug: 'team' as const, label: 'Upgrade to Team - $49/mo', featured: true },
      { slug: 'pro' as const, label: 'Upgrade to Pro - $149/mo', featured: false },
    ]
  }
  if (tier === 'team')
    return [{ slug: 'pro' as const, label: 'Upgrade to Pro - $149/mo', featured: true }]
  return []
})

const planNote = computed<{ text: string, tone: string } | null>(() => {
  const b = billing.value
  if (!b || !b.status)
    return null
  if (b.status === 'trialing')
    return { text: `Trial · ends ${fmtDate(b.currentPeriodEnd)}`, tone: 'text-signal' }
  if (b.cancelAtPeriodEnd && b.currentPeriodEnd)
    return { text: `Cancels ${fmtDate(b.currentPeriodEnd)}`, tone: 'text-fail' }
  if (b.status === 'past_due')
    return { text: 'Payment past due', tone: 'text-fail' }
  if (b.currentPeriodEnd)
    return { text: `Renews ${fmtDate(b.currentPeriodEnd)}`, tone: 'text-muted-foreground' }
  return null
})

onMounted(() => {
  if (route.query.checkout === 'success') {
    toast.success('Subscription active. It may take a moment to reflect here.')
    void refreshBilling()
    void router.replace({ query: {} })
  }
})

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
        Plan, appearance, account, and API tokens for pushing reports from CI.
      </p>
    </div>

    <!-- Plan & billing -->
    <Card v-if="billing && billing.tier !== 'selfhost'">
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>Your subscription and monthly test-result usage.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-6">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <span class="size-2 rounded-full bg-signal" aria-hidden="true" />
            <div class="flex flex-col">
              <span class="font-mono text-sm font-semibold tracking-tight">{{ TIER_LABELS[billing.tier] ?? billing.tier }}</span>
              <span v-if="planNote" class="font-mono text-[11px]" :class="planNote.tone">{{ planNote.text }}</span>
            </div>
          </div>
          <Button v-if="isPaid" type="button" variant="outline" size="sm" class="font-mono text-xs" :disabled="!!billingPending" @click="openPortal">
            <CreditCard class="size-3.5" />
            {{ billingPending === 'portal' ? 'Opening…' : 'Manage' }}
          </Button>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between">
            <span :class="labelClass">Test results · this month</span>
            <span class="font-mono text-xs tabular-nums" :class="overCap ? 'text-fail' : 'text-muted-foreground'">
              {{ billing.usedResults.toLocaleString() }}<template v-if="billing.includedResults != null"> / {{ billing.includedResults.toLocaleString() }}</template><template v-else> · unlimited</template>
            </span>
          </div>
          <div v-if="billing.includedResults != null" class="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="overCap ? 'bg-fail' : 'bg-signal'"
              :style="{ width: `${usagePct}%` }"
            />
          </div>
          <p v-if="overCap" class="font-mono text-[11px] text-fail">
            Monthly limit reached - upgrade to keep ingesting.
          </p>
          <p class="font-mono text-[11px] text-muted-foreground">
            {{ billing.retentionDays != null ? `${billing.retentionDays}-day history` : 'Unlimited history' }}
          </p>
        </div>

        <div v-if="upgradeOptions.length" class="flex flex-wrap gap-2">
          <Button
            v-for="opt in upgradeOptions"
            :key="opt.slug"
            type="button"
            size="sm"
            :variant="opt.featured ? 'default' : 'outline'"
            class="font-mono text-xs"
            :disabled="!!billingPending"
            @click="checkout(opt.slug)"
          >
            <ArrowUpRight class="size-3.5" />
            {{ billingPending === opt.slug ? 'Redirecting…' : opt.label }}
          </Button>
        </div>

        <Button
          v-if="billing.tier !== 'enterprise'"
          as-child
          variant="link"
          size="sm"
          class="self-start font-mono text-xs text-muted-foreground -mt-2"
        >
          <a :href="CONTACT_HREF">
            <Building2 class="size-3.5" />
            Need more? Contact us about Enterprise
          </a>
        </Button>
      </CardContent>
    </Card>

    <!-- Appearance -->
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Light, dark, or match your system.</CardDescription>
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
        <form class="flex flex-col gap-4" @submit.prevent="updateEmail">
          <div class="grid gap-2">
            <label :class="labelClass" for="settings-email">Email</label>
            <Input id="settings-email" v-model="emailInput" type="email" autocomplete="email" />
            <p v-if="emailError" class="text-sm text-destructive">
              {{ emailError }}
            </p>
          </div>
          <Button type="submit" :disabled="emailSaving || !emailValid" size="sm" class="self-start font-mono text-xs">
            {{ emailSaving ? 'Saving…' : 'Update email' }}
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
          <Button type="submit" :disabled="pwSubmitting || !pwMeta.valid" size="sm" class="self-start font-mono text-xs">
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
          <Button type="button" :disabled="creating || !newTokenName.trim()" size="sm" class="font-mono text-xs" @click="createToken">
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
