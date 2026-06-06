<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Check, Copy } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{ text: string }>()

const copied = ref(false)

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(props.text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    size="icon"
    class="size-7 text-muted-foreground hover:text-foreground"
    :aria-label="copied ? 'Copied' : 'Copy'"
    @click="copy"
  >
    <component :is="copied ? Check : Copy" class="size-3.5" />
  </Button>
</template>
