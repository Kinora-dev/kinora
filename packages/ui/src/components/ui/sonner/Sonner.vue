<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'
import { Toaster as Sonner } from 'vue-sonner'
import { cn } from '../../../lib/utils'

const props = defineProps<ToasterProps>()
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
      // richColors per-type, mapped to the kinora palette (pass/fail/flaky/signal).
      // bg mixes in srgb: oklch hue interpolation toward white drifts the tint (green -> pink).
      '--success-bg': 'color-mix(in srgb, var(--pass) 12%, var(--popover))',
      '--success-text': 'var(--pass)',
      '--success-border': 'color-mix(in oklch, var(--pass) 30%, transparent)',
      '--error-bg': 'color-mix(in srgb, var(--fail) 12%, var(--popover))',
      '--error-text': 'var(--fail)',
      '--error-border': 'color-mix(in oklch, var(--fail) 30%, transparent)',
      '--warning-bg': 'color-mix(in srgb, var(--flaky) 12%, var(--popover))',
      '--warning-text': 'var(--flaky)',
      '--warning-border': 'color-mix(in oklch, var(--flaky) 30%, transparent)',
      '--info-bg': 'color-mix(in srgb, var(--info) 12%, var(--popover))',
      '--info-text': 'var(--info)',
      '--info-border': 'color-mix(in oklch, var(--info) 30%, transparent)',
    }"
    v-bind="props"
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>
