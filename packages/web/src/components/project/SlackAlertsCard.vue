<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { SegmentedControl } from '@kinora/ui/segmented-control'
import { ArrowUpRight, Send } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'
import { useDemo, useServerConfig } from '@/composables/queries'
import { useAlerts } from '@/composables/useAlerts'
import { useBilling } from '@/composables/useBilling'
import { env } from '@/lib/env'

const props = defineProps<{ projectId: string }>()

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const POLICIES = [
  { value: 'always', label: 'Every run' },
  { value: 'on-failure', label: 'On failure' },
  { value: 'on-regression', label: 'On regression' },
] as const

const { summary: billing, pending: billingPending, checkout } = useBilling()
const { config, saving, testing, save, updateSettings, disconnect, sendTest } = useAlerts(props.projectId)

const { state: serverConfig } = useServerConfig()
const oauthEnabled = computed(() => serverConfig.value?.slackOauthEnabled ?? false)
const isDemo = useDemo()

const webhookUrl = ref('')
const policy = ref<typeof POLICIES[number]['value']>('on-failure')
const enabled = ref(true)

// Hydrate the form once the saved config arrives.
watch(config, (c) => {
  if (!c)
    return
  webhookUrl.value = c.webhookUrl
  policy.value = c.policy
  enabled.value = c.enabled
}, { immediate: true })

const connected = computed(() => config.value !== null)
const installUrl = computed(() => `${env.serverUrl.replace(/\/+$/, '')}/api/slack/install?projectId=${encodeURIComponent(props.projectId)}`)
// Manual path needs a valid URL; the OAuth path stores its own webhook.
const canSave = computed(() => oauthEnabled.value ? true : /^https?:\/\//.test(webhookUrl.value.trim()))

function onSave(): void {
  if (oauthEnabled.value)
    void updateSettings({ policy: policy.value, enabled: enabled.value })
  else
    void save({ webhookUrl: webhookUrl.value.trim(), policy: policy.value, enabled: enabled.value })
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Slack alerts</CardTitle>
      <CardDescription>Post a run summary to Slack, highlighting new failures and flakes.</CardDescription>
    </CardHeader>
    <CardContent>
      <!-- Paid feature: free tier sees an upsell. -->
      <div v-if="billing && !billing.alerts" class="flex flex-col items-start gap-3">
        <p class="text-sm text-muted-foreground">
          Slack alerts are a Team feature.
        </p>
        <Button type="button" size="sm" class="font-mono text-xs" :disabled="!!billingPending || isDemo" @click="checkout('team')">
          <ArrowUpRight class="size-3.5" />
          {{ billingPending === 'team' ? 'Redirecting…' : 'Upgrade to Team' }}
        </Button>
      </div>

      <div v-else-if="billing" class="flex flex-col gap-5">
        <!-- Connection source: OAuth button, OAuth connected header, or manual webhook input. -->
        <template v-if="oauthEnabled">
          <a v-if="!connected" :href="isDemo ? undefined : installUrl" class="w-fit" :class="{ 'pointer-events-none': isDemo }">
            <Button type="button" size="sm" :disabled="isDemo" class="gap-2 font-mono text-xs">
              <Icon name="slack" class="size-3.5" />
              Connect Slack
            </Button>
          </a>
          <div v-else class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-sm">
              <Icon name="slack" class="size-4 text-signal" />
              <span class="font-mono text-xs">
                {{ config?.channel ?? 'Connected' }}<template v-if="config?.teamName"> · {{ config.teamName }}</template>
              </span>
            </div>
            <Button type="button" variant="ghost" size="sm" class="font-mono text-xs text-muted-foreground" :disabled="isDemo" @click="disconnect">
              Disconnect
            </Button>
          </div>
        </template>

        <div v-else class="grid gap-2">
          <label :class="labelClass" for="slack-url">Webhook URL</label>
          <Input id="slack-url" v-model="webhookUrl" placeholder="https://hooks.slack.com/services/..." />
        </div>

        <!-- Policy/enabled/actions: shown once a destination exists. -->
        <template v-if="!oauthEnabled || connected">
          <div class="grid gap-2">
            <span :class="labelClass">Notify</span>
            <SegmentedControl
              :model-value="policy"
              :options="POLICIES"
              @update:model-value="(v) => policy = v as typeof POLICIES[number]['value']"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            class="w-fit gap-2 font-mono text-xs"
            :class="enabled ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
            @click="enabled = !enabled"
          >
            <span class="size-1.5 rounded-full" :class="enabled ? 'bg-signal' : 'bg-muted-foreground'" aria-hidden="true" />
            {{ enabled ? 'Enabled' : 'Disabled' }}
          </Button>

          <div class="flex gap-2">
            <Button type="button" size="sm" class="font-mono text-xs" :disabled="saving || !canSave || isDemo" @click="onSave">
              {{ saving ? 'Saving…' : 'Save' }}
            </Button>
            <Button type="button" variant="outline" size="sm" class="font-mono text-xs" :disabled="testing || !config || isDemo" @click="sendTest">
              <Send class="size-3.5" />
              {{ testing ? 'Sending…' : 'Send test' }}
            </Button>
          </div>
        </template>
      </div>
    </CardContent>
  </Card>
</template>
