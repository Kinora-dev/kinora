<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Input } from '@kinora/ui/input'
import { Check, Copy, Plus } from 'lucide-vue-next'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import CopyButton from '@/components/app/CopyButton.vue'
import { useApiTokens } from '@/composables/useApiTokens'
import { env } from '@/lib/env'

const { creating, createdKey, copied, create, copyCreatedKey } = useApiTokens({ autoLoad: false })
const tokenName = ref('ci-github-actions')

async function generate(): Promise<void> {
  if (await create(tokenName.value))
    tokenName.value = ''
}

const configSnippet = `// playwright.config.ts
reporter: [
  ['@kinora/reporter', { project: { slug: 'web-app' } }],
]`

const runSnippet = `KINORA_URL=${env.serverUrl} KINORA_TOKEN=<token> \\
  npx playwright test`
</script>

<template>
  <div class="mx-auto w-full max-w-2xl py-10">
    <div class="rounded-xl border border-border bg-card/60 p-7 shadow-xl backdrop-blur-sm sm:p-9">
      <!-- Awaiting-signal header -->
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Awaiting first signal
        </span>
      </div>

      <h2 class="mt-4 text-xl font-semibold tracking-tight">
        No projects reporting yet
      </h2>
      <p class="mt-1.5 text-sm text-muted-foreground">
        Push a Playwright run and pass rates, flaky tests, trends, and full traces land here.
      </p>

      <!-- Onboarding steps -->
      <ol class="mt-7 flex flex-col gap-6">
        <li class="flex gap-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 font-mono text-xs font-medium text-signal">
            01
          </span>
          <div class="min-w-0 flex-1 pt-1">
            <p class="text-sm">
              Generate a project API token.
            </p>
            <div class="mt-2 flex items-center gap-2">
              <Input
                v-model="tokenName"
                placeholder="ci-github-actions"
                class="flex-1"
                @keydown.enter.prevent="generate"
              />
              <Button type="button" :disabled="creating || !tokenName.trim()" size="sm" class="shrink-0 font-mono text-xs" @click="generate">
                <Plus class="size-3.5" />
                {{ creating ? 'Creating…' : 'Generate' }}
              </Button>
            </div>

            <!-- One-time reveal -->
            <div
              v-if="createdKey"
              class="mt-2 flex flex-col gap-2 rounded-md border border-signal/30 bg-signal/5 px-3 py-2.5"
            >
              <p class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Copy now - it will not be shown again
              </p>
              <div class="flex items-center gap-2">
                <code class="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">{{ createdKey }}</code>
                <Button type="button" variant="outline" size="sm" class="shrink-0 font-mono text-xs" @click="copyCreatedKey">
                  <component :is="copied ? Check : Copy" class="size-3.5" />
                  {{ copied ? 'Copied' : 'Copy' }}
                </Button>
              </div>
            </div>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 font-mono text-xs font-medium text-signal">
            02
          </span>
          <div class="min-w-0 flex-1 pt-1">
            <p class="text-sm">
              Add the kinora reporter to your Playwright config.
            </p>
            <div class="relative mt-2">
              <pre class="overflow-x-auto rounded-md border border-border bg-background/60 py-2.5 pr-10 pl-3 font-mono text-xs leading-relaxed text-muted-foreground">{{ configSnippet }}</pre>
              <CopyButton :text="configSnippet" class="absolute top-1.5 right-1.5" />
            </div>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 font-mono text-xs font-medium text-signal">
            03
          </span>
          <div class="min-w-0 flex-1 pt-1">
            <p class="text-sm">
              Run your suite pointed at this server (paste the token above into <code class="rounded bg-background/60 px-1 py-0.5 font-mono text-xs">KINORA_TOKEN</code>).
            </p>
            <div class="relative mt-2">
              <pre class="overflow-x-auto rounded-md border border-border bg-background/60 py-2.5 pr-10 pl-3 font-mono text-xs leading-relaxed text-muted-foreground">{{ runSnippet }}</pre>
              <CopyButton :text="runSnippet" class="absolute top-1.5 right-1.5" />
            </div>
          </div>
        </li>
      </ol>

      <p class="mt-8 text-xs text-muted-foreground">
        Manage tokens any time in
        <RouterLink :to="{ name: 'settings' }" class="font-medium text-foreground underline-offset-4 hover:underline">
          Settings
        </RouterLink>.
      </p>
    </div>
  </div>
</template>
