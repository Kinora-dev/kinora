<script setup lang="ts">
import { Check, Link2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'

const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    toast.success('Link copied')
    setTimeout(() => (copied.value = false), 1500)
  }
  catch {
    toast.error('Could not copy link')
  }
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
