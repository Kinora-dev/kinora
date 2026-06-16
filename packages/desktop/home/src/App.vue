<script setup lang="ts">
import type { Project, RunComparison, RunReport, SessionUser, TestHistory } from '../../src/bridge'
import { latestRun } from '@kinora/core'
import { Button } from '@kinora/ui/button'
import { Card, CardContent } from '@kinora/ui/card'
import { computed, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import Failures from './components/Failures.vue'

const STORE_KEY = 'kinora-desktop-project'

const view = ref<'loading' | 'login' | 'projects'>('loading')
const user = ref<SessionUser | null>(null)
const error = ref('')
const devicePending = ref(false)
const deviceCode = ref('')
const projects = ref<Project[]>([])
const activeId = ref<string | null>(null)
const report = ref<RunReport | null>(null)
const histories = ref<TestHistory[]>([])
const comparison = ref<RunComparison | null>(null)
const reportLoading = ref(false)

const activeProject = computed(() => projects.value.find(p => p.id === activeId.value) ?? null)

// Load the active project's latest run (the failures inbox renders from it).
async function loadActive(): Promise<void> {
  report.value = null
  histories.value = []
  comparison.value = null
  const p = activeProject.value
  if (!p)
    return
  const latest = latestRun(p)
  if (!latest)
    return
  // Most recent earlier run with no hard failures = the "last green" baseline.
  const green = p.runs.find(r => r.runId !== latest.runId && r.counts.unexpected === 0)
  const latestHasFails = latest.counts.unexpected > 0 || latest.counts.flaky > 0
  reportLoading.value = true
  try {
    const [run, hist] = await Promise.all([
      window.kinora.run({ projectId: p.id, runId: latest.runId }),
      window.kinora.projectHistory({ projectId: p.id }),
    ])
    report.value = run
    histories.value = hist
    if (green && latestHasFails)
      comparison.value = await window.kinora.compareRuns({ projectId: p.id, baseRunId: green.runId, headRunId: latest.runId })
  }
  finally {
    reportLoading.value = false
  }
}

async function refresh(): Promise<void> {
  const s = await window.kinora.session()
  if (!s.loggedIn) {
    view.value = 'login'
    return
  }
  user.value = s.user
  projects.value = await window.kinora.projects()
  const stored = localStorage.getItem(STORE_KEY)
  activeId.value = projects.value.find(p => p.id === stored)?.id ?? projects.value[0]?.id ?? null
  view.value = 'projects'
  await loadActive()
}

onMounted(refresh)

window.kinora.onDevicePending((info) => {
  deviceCode.value = info.userCode
})

function selectProject(id: string): void {
  activeId.value = id
  localStorage.setItem(STORE_KEY, id)
  void loadActive()
}

async function onDeviceLogin(): Promise<void> {
  error.value = ''
  deviceCode.value = ''
  devicePending.value = true
  const res = await window.kinora.loginWithDevice()
  devicePending.value = false
  if (res.ok)
    await refresh()
  else if (res.error && res.error !== 'cancelled')
    error.value = res.error
}

function onCancelDevice(): void {
  void window.kinora.cancelDeviceLogin()
  devicePending.value = false
  deviceCode.value = ''
}

async function onLogout(): Promise<void> {
  await window.kinora.logout()
  projects.value = []
  activeId.value = null
  report.value = null
  user.value = null
  view.value = 'login'
}

function openTrace(): void {
  void window.kinora.openLocalTrace()
}

function openAccount(): void {
  void window.kinora.openAccount()
}

function onViewTrace(traceUrl: string): void {
  void window.kinora.openTraceUrl(traceUrl)
}
</script>

<template>
  <!-- login: single device flow (signs in via the system browser: github/google/email) -->
  <div v-if="view === 'login'" class="app-grid flex h-full flex-col items-center justify-center gap-7 bg-background p-6">
    <div class="flex flex-col items-center gap-2 text-center">
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-xl font-semibold tracking-tight lowercase">kinora</span>
      </div>
      <span class="font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">desktop</span>
    </div>
    <Card class="w-full max-w-sm">
      <CardContent class="space-y-4">
        <p class="text-center text-sm text-muted-foreground">
          Sign in to your kinora account.
        </p>
        <div v-if="devicePending" class="space-y-2 text-center">
          <p class="text-xs text-muted-foreground">
            Approve in your browser. Confirm this code:
          </p>
          <p class="font-mono text-lg font-semibold tracking-[0.3em]">
            {{ deviceCode || '····' }}
          </p>
          <Button variant="ghost" size="sm" class="text-xs text-muted-foreground" @click="onCancelDevice">
            Cancel
          </Button>
        </div>
        <Button v-else class="w-full bg-signal text-white hover:bg-signal/90" @click="onDeviceLogin">
          Sign in with browser
        </Button>
        <p v-if="error" class="rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-xs text-fail">
          {{ error }}
        </p>
      </CardContent>
    </Card>
  </div>

  <!-- loading -->
  <div v-else-if="view === 'loading'" class="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
    Loading…
  </div>

  <!-- dashboard: failures of the active project's latest run -->
  <div v-else class="app-grid flex h-full flex-col bg-background text-foreground">
    <AppHeader
      :projects="projects"
      :active-id="activeId"
      :user="user"
      @select="selectProject"
      @open-trace="openTrace"
      @open-account="openAccount"
      @logout="onLogout"
    />

    <main class="mx-auto w-full max-w-4xl flex-1 overflow-auto px-5 py-8">
      <p v-if="projects.length === 0" class="py-16 text-center font-mono text-sm text-muted-foreground">
        No projects yet. Push a run from the reporter or CLI.
      </p>
      <Failures
        v-else-if="activeProject"
        :key="activeProject.id"
        :project="activeProject"
        :report="report"
        :histories="histories"
        :comparison="comparison"
        :loading="reportLoading"
        @view-trace="onViewTrace"
      />
    </main>
  </div>
</template>
