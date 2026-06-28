<script setup lang="ts">
import { ArrowUpRight } from 'lucide-vue-next'
import { useDemo } from '@/composables/queries'

const isDemo = useDemo()
// Demo writes are blocked server-side; send conversions to the real app's signup.
const signupUrl = 'https://app.kinora.dev/signup'
</script>

<template>
  <div v-if="isDemo" class=" bg-background">
    <div class="border-b border-signal/25 bg-signal/10">
      <div class="mx-auto flex max-w-7xl items-center gap-2.5 px-5 py-2 font-mono text-xs">
        <span class="size-1.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
        <span class="font-semibold text-foreground">Read-only demo</span>
        <span class="hidden text-muted-foreground sm:inline">explore freely, changes are disabled.</span>
        <a
          :href="signupUrl"
          class="ml-auto inline-flex shrink-0 items-center gap-1 text-signal underline-offset-4 hover:underline"
        >
          Create your workspace
          <ArrowUpRight class="size-3.5" />
        </a>
      </div>
    </div>
  </div>
</template>
