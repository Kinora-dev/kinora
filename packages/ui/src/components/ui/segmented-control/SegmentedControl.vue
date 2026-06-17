<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Component, HTMLAttributes } from 'vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { cn } from '../../../lib/utils'

interface Option {
  value: string
  label: string
  icon?: Component
}

const props = defineProps<{
  modelValue: string
  options: readonly Option[]
  // Icon-only (label moves to title/aria-label), for tight spots like a dropdown.
  iconOnly?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Radio never deselects, but guard against an empty emit just in case.
function onUpdate(value: AcceptableValue): void {
  if (value)
    emit('update:modelValue', String(value))
}
</script>

<template>
  <RadioGroupRoot
    :model-value="props.modelValue"
    orientation="horizontal"
    :class="cn('inline-flex flex-wrap gap-2', props.class)"
    @update:model-value="onUpdate"
  >
    <RadioGroupItem
      v-for="opt in options"
      :key="opt.value"
      :value="opt.value"
      :aria-label="iconOnly ? opt.label : undefined"
      :title="iconOnly ? opt.label : undefined"
      :class="cn('inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-background font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-signal/60 data-[state=checked]:text-signal data-[state=checked]:hover:text-signal disabled:pointer-events-none disabled:opacity-50', iconOnly ? 'w-8 justify-center' : 'px-3')"
    >
      <component :is="opt.icon" v-if="opt.icon" class="size-3.5" />
      <template v-if="!iconOnly">
        {{ opt.label }}
      </template>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
