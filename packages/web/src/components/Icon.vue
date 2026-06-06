<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  class?: string
}>()

// Eager ?raw: brand/custom SVGs inlined at build so they inherit currentColor (lucide covers UI icons).
const icons = import.meta.glob<string>('/src/assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const svg = computed(() => {
  const raw = icons[`/src/assets/icons/${props.name}.svg`]
  if (!raw) {
    if (import.meta.env.DEV)
      console.warn(`[Icon] unknown icon "${props.name}"`)
    return ''
  }
  // Only force currentColor when the svg sets no fill of its own, so multicolor icons stay intact.
  return raw.replace(/<svg([^>]*)>/, (m, attrs) => (/fill=/i.test(attrs) ? m : `<svg${attrs} fill="currentColor">`))
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- content is build-time local assets, never user input -->
  <span
    class="inline-flex shrink-0 [&>svg]:size-full"
    :class="props.class"
    aria-hidden="true"
    v-html="svg"
  />
</template>
