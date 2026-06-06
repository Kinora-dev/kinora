<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../../lib/utils'
import { Label } from '../label'
import { useFormField } from './useFormField'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const { error, formItemId } = useFormField()
</script>

<template>
  <Label
    data-slot="form-label"
    :data-error="!!error"
    :for="formItemId"
    :class="cn('data-[error=true]:text-destructive', props.class)"
  >
    <slot />
  </Label>
</template>
