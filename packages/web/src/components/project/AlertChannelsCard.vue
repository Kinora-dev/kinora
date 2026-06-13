<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { Mail, Send, Trash2, Webhook } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { useAlertChannels } from '@/composables/useAlertChannels'
import { useBilling } from '@/composables/useBilling'

const props = defineProps<{ projectId: string }>()

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const POLICIES = [
  { value: 'always', label: 'Every run' },
  { value: 'on-failure', label: 'On failure' },
  { value: 'on-regression', label: 'On regression' },
] as const

const { summary: billing, pending: billingPending, checkout } = useBilling()
const { channels, adding, testingId, add, update, remove, test } = useAlertChannels(props.projectId)

const addKind = ref<'email' | 'webhook'>('email')
const addTarget = ref('')
const addPolicy = ref<typeof POLICIES[number]['value']>('on-failure')

const targetPlaceholder = computed(() => addKind.value === 'email' ? 'alerts@team.dev' : 'https://example.com/hook')
const targetValid = computed(() => (addKind.value === 'email' ? z.email() : z.url()).safeParse(addTarget.value.trim()).success)
const showTargetError = computed(() => addTarget.value.trim().length > 0 && !targetValid.value)
const targetError = computed(() => addKind.value === 'email' ? 'Enter a valid email address' : 'Enter a valid URL (https://…)')

async function onAdd(): Promise<void> {
  if (!targetValid.value)
    return
  if (await add({ kind: addKind.value, target: addTarget.value.trim(), policy: addPolicy.value }))
    addTarget.value = ''
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Email &amp; webhook alerts</CardTitle>
      <CardDescription>Send run summaries to an email address or a custom webhook (POST JSON).</CardDescription>
    </CardHeader>
    <CardContent>
      <!-- Paid feature: free tier sees an upsell. -->
      <div v-if="billing && !billing.alerts" class="flex flex-col items-start gap-3">
        <p class="text-sm text-muted-foreground">
          Email &amp; webhook alerts are a Team feature.
        </p>
        <Button type="button" size="sm" class="font-mono text-xs" :disabled="!!billingPending" @click="checkout('team')">
          {{ billingPending === 'team' ? 'Redirecting…' : 'Upgrade to Team' }}
        </Button>
      </div>

      <div v-else-if="billing" class="flex flex-col gap-6">
        <!-- Existing channels -->
        <ul v-if="channels.length" class="flex flex-col gap-3">
          <li
            v-for="ch in channels"
            :key="ch.id"
            class="flex flex-col gap-3 rounded-lg border border-border p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-2">
                <component :is="ch.kind === 'email' ? Mail : Webhook" class="size-4 shrink-0 text-muted-foreground" />
                <span class="truncate font-mono text-xs">{{ ch.target }}</span>
              </div>
              <div class="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" class="font-mono text-xs" :disabled="testingId === ch.id" @click="test(ch.id)">
                  <Send class="size-3.5" />
                  {{ testingId === ch.id ? 'Sending…' : 'Test' }}
                </Button>
                <Button type="button" variant="ghost" size="sm" class="text-muted-foreground hover:text-fail" aria-label="Remove channel" @click="remove(ch.id)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                v-for="opt in POLICIES"
                :key="opt.value"
                type="button"
                variant="outline"
                size="sm"
                class="font-mono text-xs"
                :class="ch.policy === opt.value ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
                @click="update(ch.id, { policy: opt.value, enabled: ch.enabled })"
              >
                {{ opt.label }}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="gap-2 font-mono text-xs"
                :class="ch.enabled ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
                @click="update(ch.id, { policy: ch.policy, enabled: !ch.enabled })"
              >
                <span class="size-1.5 rounded-full" :class="ch.enabled ? 'bg-signal' : 'bg-muted-foreground'" aria-hidden="true" />
                {{ ch.enabled ? 'Enabled' : 'Disabled' }}
              </Button>
            </div>
          </li>
        </ul>

        <!-- Add a channel -->
        <form class="flex flex-col gap-3 border-t border-border pt-5" @submit.prevent="onAdd">
          <span :class="labelClass">Add a channel</span>
          <div class="flex gap-2">
            <Button
              v-for="k in (['email', 'webhook'] as const)"
              :key="k"
              type="button"
              variant="outline"
              size="sm"
              class="gap-2 font-mono text-xs capitalize"
              :class="addKind === k ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
              @click="addKind = k"
            >
              <component :is="k === 'email' ? Mail : Webhook" class="size-3.5" />
              {{ k }}
            </Button>
          </div>
          <div class="grid gap-2">
            <Input v-model="addTarget" :placeholder="targetPlaceholder" :type="addKind === 'email' ? 'email' : 'url'" />
            <p v-if="showTargetError" class="text-sm text-destructive">
              {{ targetError }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="opt in POLICIES"
              :key="opt.value"
              type="button"
              variant="outline"
              size="sm"
              class="font-mono text-xs"
              :class="addPolicy === opt.value ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
              @click="addPolicy = opt.value"
            >
              {{ opt.label }}
            </Button>
          </div>
          <Button type="submit" size="sm" class="w-fit font-mono text-xs" :disabled="adding || !targetValid">
            {{ adding ? 'Adding…' : 'Add channel' }}
          </Button>
        </form>
      </div>
    </CardContent>
  </Card>
</template>
