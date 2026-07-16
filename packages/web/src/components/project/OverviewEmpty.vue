<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Input } from '@kinora/ui/input'
import { Check, Copy, Plus } from 'lucide-vue-next'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import CopyButton from '@/components/app/CopyButton.vue'
import { useApiTokens } from '@/composables/useApiTokens'
import { env, isSelfHost } from '@/lib/env'

const { creating, createdKey, copied, create, copyCreatedKey } = useApiTokens({ autoLoad: false })
const tokenName = ref('ci-github-actions')

async function generate(): Promise<void> {
  if (await create(tokenName.value))
    tokenName.value = ''
}

const mode = ref<'ai' | 'manual'>('ai')

const setupDocUrl = 'https://kinora.dev/llms/setup.md'
const aiPrompt = [
  'Set up kinora Playwright reporting in this repository.',
  `Read ${setupDocUrl} and follow it.`,
  ...(isSelfHost ? [`My kinora server is at ${env.serverUrl}; set KINORA_URL to it.`] : []),
  'I have created a kinora API token and will add it as KINORA_TOKEN to my CI secrets (and a local .env if I run the suite locally). Do not hardcode it.',
].join('\n\n')

const configSnippet = `export default defineConfig({
  reporter: [['@kinora/reporter', { project: { slug: 'web-app' } }]],
  // enable tracing so View trace works
  use: { trace: 'on-first-retry' },
})`

const runSnippet = isSelfHost
  ? `KINORA_URL=${env.serverUrl} KINORA_TOKEN=<token> npx playwright test`
  : 'KINORA_TOKEN=<token> npx playwright test'
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

      <!-- Setup-path toggle -->
      <div class="mt-6 inline-flex rounded-md border border-border p-0.5">
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="mode === 'ai' ? 'bg-signal/10 text-signal' : 'text-muted-foreground hover:text-foreground'"
          @click="mode = 'ai'"
        >
          With an AI agent
        </button>
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="mode === 'manual' ? 'bg-signal/10 text-signal' : 'text-muted-foreground hover:text-foreground'"
          @click="mode = 'manual'"
        >
          Manually
        </button>
      </div>

      <!-- Onboarding steps -->
      <ol class="mt-5 flex flex-col gap-6">
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

        <!-- AI path -->
        <li v-if="mode === 'ai'" class="flex gap-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 font-mono text-xs font-medium text-signal">
            02
          </span>
          <div class="min-w-0 flex-1 pt-1">
            <p class="text-sm">
              Paste this into your coding agent (Claude Code, Cursor, Copilot, …). It reads the setup doc and configures the reporter for you.
            </p>
            <div class="mt-2 overflow-hidden rounded-md border border-border bg-background/60">
              <div class="border-b border-border/80 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                Prompt
              </div>
              <div class="relative">
                <pre class="overflow-x-auto py-2.5 pr-10 pl-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{{ aiPrompt }}</pre>
                <CopyButton :text="aiPrompt" data-umami-event="onboarding-copy" data-umami-event-path="ai" class="absolute top-1.5 right-1.5" />
              </div>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              Keep the token above out of the prompt - the agent tells you to add it to your secrets.
            </p>
          </div>
        </li>

        <!-- Manual path -->
        <li v-if="mode === 'manual'" class="flex gap-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 font-mono text-xs font-medium text-signal">
            02
          </span>
          <div class="min-w-0 flex-1 pt-1">
            <p class="text-sm">
              Add the kinora reporter to your Playwright config.
            </p>
            <div class="mt-2 overflow-hidden rounded-md border border-border bg-background/60">
              <div class="border-b border-border/80 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                playwright.config.ts
              </div>
              <div class="relative">
                <pre class="overflow-x-auto py-2.5 pr-10 pl-3 font-mono text-xs leading-relaxed text-muted-foreground">{{ configSnippet }}</pre>
                <CopyButton :text="configSnippet" data-umami-event="onboarding-copy" data-umami-event-path="config" class="absolute top-1.5 right-1.5" />
              </div>
            </div>
          </div>
        </li>

        <li v-if="mode === 'manual'" class="flex gap-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/30 bg-signal/10 font-mono text-xs font-medium text-signal">
            03
          </span>
          <div class="min-w-0 flex-1 pt-1">
            <p class="text-sm">
              Run your suite pointed at this server (paste the token above into <code class="rounded bg-background/60 px-1 py-0.5 font-mono text-xs">KINORA_TOKEN</code>).
            </p>
            <div class="mt-2 overflow-hidden rounded-md border border-border bg-background/60">
              <div class="border-b border-border/80 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                CI
              </div>
              <div class="relative">
                <pre class="overflow-x-auto py-2.5 pr-10 pl-3 font-mono text-xs leading-relaxed text-muted-foreground">{{ runSnippet }}</pre>
                <CopyButton :text="runSnippet" data-umami-event="onboarding-copy" data-umami-event-path="run" class="absolute top-1.5 right-1.5" />
              </div>
            </div>
          </div>
        </li>
      </ol>

      <p class="mt-8 text-xs text-muted-foreground">
        Manage tokens any time in
        <RouterLink :to="{ name: 'settings-workspace' }" class="font-medium text-foreground underline-offset-4 hover:underline">
          Workspace settings
        </RouterLink>.
      </p>
    </div>
  </div>
</template>
