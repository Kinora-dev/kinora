<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { ArrowUpRight, Building2, Check, ChevronDown, Copy, CreditCard, KeyRound, Minus, Plus, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import TeamCard from '@/components/app/TeamCard.vue'
import { useDemo } from '@/composables/queries'
import { useApiTokens } from '@/composables/useApiTokens'
import { useBilling } from '@/composables/useBilling'
import { useOrg } from '@/composables/useOrg'
import { env } from '@/lib/env'

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const isDemo = useDemo()
const { org, isOwner, isAdmin, rename, renaming } = useOrg()
const orgName = computed(() => org.value?.name ?? 'Workspace')

const nameInput = ref('')
watch(org, (o) => {
  if (o)
    nameInput.value = o.name
}, { immediate: true })
const canRename = computed(() => {
  const n = nameInput.value.trim()
  return n.length > 0 && n !== org.value?.name
})
function onRename(): void {
  void rename(nameInput.value)
}

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

// --- MCP server (coding agents) ---
const mcpConfig = computed(() => JSON.stringify({
  mcpServers: {
    kinora: {
      command: 'npx',
      args: ['-y', '@kinora/mcp'],
      env: { KINORA_TOKEN: '<token>', KINORA_URL: env.serverUrl },
    },
  },
}, null, 2))
const mcpCopied = ref(false)
async function copyMcp(): Promise<void> {
  await navigator.clipboard.writeText(mcpConfig.value)
  mcpCopied.value = true
  setTimeout(() => (mcpCopied.value = false), 1500)
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

// Mirrors the landing pricing section and server entitlements; keep in sync by hand.
const PLAN_COLUMNS = [
  { tier: 'free', name: 'Free', price: '$0/mo' },
  { tier: 'team', name: 'Team', price: '$49/mo' },
  { tier: 'pro', name: 'Pro', price: '$149/mo' },
] as const

const PLAN_ROWS: { label: string, values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: 'Test results / mo', values: ['2,500', '10,000', '50,000'] },
  { label: 'Extra results', values: [false, '$5 / 1k', '$4 / 1k'] },
  { label: 'Projects', values: ['1', 'Unlimited', 'Unlimited'] },
  { label: 'History', values: ['7 days', '90 days', '1 year'] },
  { label: 'Regression alerts', values: [false, true, true] },
  { label: 'Seats', values: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Support', values: ['Community', 'Email', 'Priority'] },
]

const showCompare = ref(false)

const planNote = computed<{ text: string, tone: string } | null>(() => {
  const b = billing.value
  if (!b || !b.status)
    return null
  if (b.status === 'trialing') {
    return b.cancelAtPeriodEnd
      ? { text: `Trial · ends ${fmtDate(b.currentPeriodEnd)} · won't renew`, tone: 'text-fail' }
      : { text: `Trial · ends ${fmtDate(b.currentPeriodEnd)}`, tone: 'text-signal' }
  }
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

    <!-- Workspace name (admins) -->
    <Card v-if="isAdmin">
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>The name shown in the switcher and to your team.</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-1.5">
            <label :class="labelClass" for="ws-name">Name</label>
            <Input id="ws-name" v-model="nameInput" @keydown.enter.prevent="onRename" />
          </div>
          <Button type="button" size="sm" class="font-mono text-xs" :disabled="renaming || !canRename || isDemo" @click="onRename">
            {{ renaming ? 'Saving…' : 'Rename' }}
          </Button>
        </div>
      </CardContent>
    </Card>

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
          <Button v-if="isPaid && isOwner" type="button" variant="outline" size="sm" class="font-mono text-xs" :disabled="!!billingPending || isDemo" @click="openPortal">
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
            :disabled="!!billingPending || isDemo"
            @click="checkout(opt.slug)"
          >
            <ArrowUpRight class="size-3.5" />
            {{ billingPending === opt.slug ? 'Redirecting…' : opt.label }}
          </Button>
        </div>

        <!-- Plan comparison -->
        <div v-if="['free', 'team'].includes(billing.tier)" class="flex flex-col gap-3 -mt-2">
          <button
            type="button"
            class="flex items-center gap-1.5 self-start font-mono text-[11px] tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
            :aria-expanded="showCompare"
            @click="showCompare = !showCompare"
          >
            <ChevronDown class="size-3.5 transition-transform" :class="showCompare ? 'rotate-180' : ''" />
            Compare plans
          </button>
          <div v-if="showCompare" class="overflow-x-auto rounded-md border border-border/70">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border/70">
                  <th class="px-3 py-2.5" />
                  <th
                    v-for="col in PLAN_COLUMNS"
                    :key="col.tier"
                    class="px-3 py-2.5 text-left"
                    :class="col.tier === billing.tier ? 'text-signal' : ''"
                  >
                    <div class="font-mono text-xs font-semibold uppercase tracking-wider">
                      {{ col.name }}<span v-if="col.tier === billing.tier" class="ml-1.5 font-normal normal-case text-[10px]">· current</span>
                    </div>
                    <div class="font-mono text-[11px] font-normal text-muted-foreground">
                      {{ col.price }}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/40">
                <tr v-for="row in PLAN_ROWS" :key="row.label">
                  <td class="px-3 py-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                    {{ row.label }}
                  </td>
                  <td v-for="(value, i) in row.values" :key="i" class="px-3 py-2 tabular-nums" :class="PLAN_COLUMNS[i].tier === billing.tier ? '' : 'text-muted-foreground'">
                    <Check v-if="value === true" class="size-4 text-signal" aria-label="Included" />
                    <Minus v-else-if="value === false" class="size-4 text-muted-foreground/50" aria-label="Not included" />
                    <template v-else>
                      {{ value }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
        <CardDescription>Used as a Bearer token to push reports from the reporter or CLI, and to read this workspace from the MCP server.</CardDescription>
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

        <!-- Create (admins only) -->
        <div v-if="isAdmin" class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-1.5">
            <label class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase" for="token-name">
              New token name
            </label>
            <Input id="token-name" v-model="newTokenName" placeholder="ci-github-actions" @keydown.enter.prevent="createToken" />
          </div>
          <Button type="button" :disabled="creating || !newTokenName.trim() || isDemo" size="sm" class="font-mono text-xs" @click="createToken">
            <Plus class="size-3.5" />
            {{ creating ? 'Creating…' : 'Create' }}
          </Button>
        </div>
        <p v-else class="font-mono text-[11px] text-muted-foreground">
          Only admins can create or revoke tokens.
        </p>

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
              v-if="isAdmin"
              type="button"
              variant="ghost"
              size="icon"
              class="size-8 shrink-0 text-muted-foreground hover:text-fail"
              aria-label="Delete token"
              :disabled="isDemo"
              @click="deleteToken(token.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- MCP server for coding agents -->
    <Card>
      <CardHeader>
        <CardTitle>Coding agents (MCP)</CardTitle>
        <CardDescription>Point Claude Code, Cursor, or any MCP client at this workspace to debug failing tests from your editor. Add this to your agent's MCP config.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span :class="labelClass">mcp config</span>
          <Button type="button" variant="outline" size="sm" class="font-mono text-xs" @click="copyMcp">
            <component :is="mcpCopied ? Check : Copy" class="size-3.5" />
            {{ mcpCopied ? 'Copied' : 'Copy' }}
          </Button>
        </div>
        <pre class="overflow-x-auto rounded-md border border-border/70 bg-background px-4 py-3 font-mono text-xs leading-relaxed"><code>{{ mcpConfig }}</code></pre>
        <p class="font-mono text-[11px] text-muted-foreground">
          Runs locally via <code>npx</code>. Replace <code>&lt;token&gt;</code> with an API token from above.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
