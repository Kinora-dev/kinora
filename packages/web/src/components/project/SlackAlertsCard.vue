<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { Send } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useAlerts } from '@/composables/useAlerts'
import { useBilling } from '@/composables/useBilling'

const props = defineProps<{ projectId: string }>()

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const POLICIES = [
  { value: 'always', label: 'Every run' },
  { value: 'on-failure', label: 'On failure' },
  { value: 'on-regression', label: 'On regression' },
] as const

const { summary: billing, pending: billingPending, checkout } = useBilling()
const { config, saving, testing, save, sendTest } = useAlerts(props.projectId)

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

const canSave = computed(() => /^https?:\/\//.test(webhookUrl.value.trim()))

function onSave(): void {
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
        <Button type="button" size="sm" class="font-mono text-xs" :disabled="!!billingPending" @click="checkout('team')">
          {{ billingPending === 'team' ? 'Redirecting…' : 'Upgrade to Team' }}
        </Button>
      </div>

      <div v-else-if="billing" class="flex flex-col gap-5">
        <div class="grid gap-2">
          <label :class="labelClass" for="slack-url">Webhook URL</label>
          <Input id="slack-url" v-model="webhookUrl" placeholder="https://hooks.slack.com/services/..." />
        </div>

        <div class="grid gap-2">
          <span :class="labelClass">Notify</span>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="opt in POLICIES"
              :key="opt.value"
              type="button"
              variant="outline"
              size="sm"
              class="font-mono text-xs"
              :class="policy === opt.value ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
              @click="policy = opt.value"
            >
              {{ opt.label }}
            </Button>
          </div>
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
          <Button type="button" size="sm" class="font-mono text-xs" :disabled="saving || !canSave" @click="onSave">
            {{ saving ? 'Saving…' : 'Save' }}
          </Button>
          <Button type="button" variant="outline" size="sm" class="font-mono text-xs" :disabled="testing || !config" @click="sendTest">
            <Send class="size-3.5" />
            {{ testing ? 'Sending…' : 'Send test' }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
