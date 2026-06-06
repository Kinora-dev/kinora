<script setup lang="ts">
import type { AvatarRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AvatarRoot } from 'reka-ui'
import { cn } from '../../../lib/utils'

const props = defineProps<AvatarRootProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <AvatarRoot
    data-slot="avatar"
    v-bind="delegatedProps"
    :class="cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', props.class)"
  >
    <slot />
  </AvatarRoot>
</template>
