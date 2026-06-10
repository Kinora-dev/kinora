<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { ArrowUpRight, Building2, Check, Copy, CreditCard, KeyRound, Plus, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import TeamCard from '@/components/app/TeamCard.vue'
import { useApiTokens } from '@/composables/useApiTokens'
import { useBilling } from '@/composables/useBilling'
import { useOrg } from '@/composables/useOrg'

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const { org, isOwner } = useOrg()
const orgName = computed(() => org.value?.name ?? 'Workspace')

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
  <div class="flex flex-col gap-8">
    <p class="font-mono text-xs text-muted-foreground -mt-2">
      Settings for <span class="text-foreground">{{ orgName }}</span>
    </p>

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
          <Button v-if="isPaid && isOwner" type="button" variant="outline" size="sm" class="font-mono text-xs" :disabled="!!billingPending" @click="openPortal">
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

        <div v-if="upgradeOptions.length && isOwner" class="flex flex-wrap gap-2">
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
          v-if="billing.tier !== 'enterprise' && isOwner"
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

        <p v-if="!isOwner" class="font-mono text-[11px] text-muted-foreground">
          Only the workspace owner can change the plan.
        </p>
      </CardContent>
    </Card>

    <!-- Team -->
    <TeamCard />

    <!-- API tokens -->
    <Card>
      <CardHeader>
        <CardTitle>API tokens</CardTitle>
        <CardDescription>Used as a Bearer token to push reports from the reporter or CLI into this workspace.</CardDescription>
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
