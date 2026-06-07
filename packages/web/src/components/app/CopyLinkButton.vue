<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Check, Link2 } from 'lucide-vue-next'
import { ref } from 'vue'

const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    class="shrink-0 font-mono text-xs text-muted-foreground"
    @click="copy"
  >
    <component :is="copied ? Check : Link2" class="size-3.5" />
    {{ copied ? 'Copied' : 'Copy link' }}
  </Button>
</template>
