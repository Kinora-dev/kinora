<script setup lang="ts">
import type { SplitterResizeHandleEmits, SplitterResizeHandleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { SplitterResizeHandle, useForwardPropsEmits } from 'reka-ui'
import { cn } from '../../../lib/utils'

const props = defineProps<SplitterResizeHandleProps & { class?: HTMLAttributes['class'], withHandle?: boolean }>()
const emits = defineEmits<SplitterResizeHandleEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'withHandle')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SplitterResizeHandle
    data-slot="resizable-handle"
    v-bind="forwarded"
    :class="cn(
      'group relative flex w-px items-center justify-center bg-border transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 hover:bg-signal/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none data-[state=drag]:bg-signal data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-2 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0',
      props.class,
    )"
  >
    <div
      v-if="withHandle"
      class="z-10 flex h-5 w-2.5 shrink-0 items-center justify-center rounded-xs border border-border bg-muted group-data-[orientation=vertical]:h-2.5 group-data-[orientation=vertical]:w-5"
    >
      <div class="h-3 w-0.5 rounded-full bg-muted-foreground/60 group-data-[orientation=vertical]:h-0.5 group-data-[orientation=vertical]:w-3" />
    </div>
  </SplitterResizeHandle>
</template>
