<script setup lang="ts">
import type { Project, RunReport } from '../../src/bridge'
import { denom, formatPct, latestRun, runHealth } from '@kinora/core'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { Separator } from '@kinora/ui/separator'
import { StatBlock } from '@kinora/ui/stat-block'
import { computed, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ProjectCard from './components/ProjectCard.vue'
import ProjectDetail from './components/ProjectDetail.vue'

const view = ref<'loading' | 'login' | 'projects'>('loading')
const serverUrl = ref('http://localhost:3000')
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const projects = ref<Project[]>([])
const selected = ref<Project | null>(null)
const report = ref<RunReport | null>(null)
const reportLoading = ref(false)

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const stats = computed(() => {
  const latest = projects.value.map(latestRun).filter(r => r != null)
  let pass = 0
  let total = 0
  let tests = 0
  let failing = 0
  for (const r of latest) {
    pass += r.counts.expected + r.counts.flaky
    total += denom(r.counts)
    tests += r.counts.total
    if (runHealth(r.counts) === 'failing')
      failing++
  }
  const runs = projects.value.reduce((sum, p) => sum + p.runs.length, 0)
  return {
    projects: projects.value.length,
    runs,
    tests,
    failing,
    passRate: total === 0 ? 1 : pass / total,
  }
})

async function refresh(): Promise<void> {
  const s = await window.kinora.session()
  serverUrl.value = s.serverUrl
  if (s.loggedIn) {
    projects.value = await window.kinora.projects()
    view.value = 'projects'
  }
  else {
    view.value = 'login'
  }
}

onMounted(refresh)

async function onLogin(): Promise<void> {
  error.value = ''
  submitting.value = true
  const res = await window.kinora.login({ serverUrl: serverUrl.value, email: email.value, password: password.value })
  submitting.value = false
  if (!res.ok) {
    error.value = res.error || 'Sign in failed'
    return
  }
  password.value = ''
  await refresh()
}

async function onLogout(): Promise<void> {
  await window.kinora.logout()
  projects.value = []
  selected.value = null
  report.value = null
  view.value = 'login'
}

function openTrace(): void {
  void window.kinora.openLocalTrace()
}

async function openProject(p: Project): Promise<void> {
  selected.value = p
  report.value = null
  const latest = latestRun(p)
  if (!latest)
    return
  reportLoading.value = true
  try {
    report.value = await window.kinora.run({ projectId: p.id, runId: latest.runId })
  }
  finally {
    reportLoading.value = false
  }
}

function onViewTrace(traceUrl: string): void {
  void window.kinora.openTraceUrl(traceUrl)
}
</script>

<template>
  <!-- login: standalone, no app chrome (matches web) -->
  <div v-if="view === 'login'" class="flex h-full items-center justify-center bg-background p-6">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-base">
          Sign in to kinora
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="onLogin">
          <div class="space-y-1.5">
            <label :class="labelClass" for="server">Server</label>
            <Input id="server" v-model="serverUrl" type="url" placeholder="https://api.kinora.dev" />
          </div>
          <div class="space-y-1.5">
            <label :class="labelClass" for="email">Email</label>
            <Input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@team.dev" />
          </div>
          <div class="space-y-1.5">
            <label :class="labelClass" for="password">Password</label>
            <Input id="password" v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <p v-if="error" class="rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-xs text-fail">
            {{ error }}
          </p>
          <Button type="submit" :disabled="submitting" class="w-full bg-signal text-white hover:bg-signal/90">
            {{ submitting ? 'Signing in…' : 'Sign in' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>

  <!-- loading -->
  <div v-else-if="view === 'loading'" class="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
    Loading…
  </div>

  <!-- dashboard -->
  <div v-else class="app-grid flex h-full flex-col bg-background text-foreground">
    <AppHeader :server-url="serverUrl" @open-trace="openTrace" @logout="onLogout" />

    <main class="mx-auto w-full max-w-7xl flex-1 overflow-auto px-5 py-8">
      <ProjectDetail
        v-if="selected"
        :project="selected"
        :report="report"
        :loading="reportLoading"
        @back="selected = null"
        @view-trace="onViewTrace"
      />
      <div v-else class="flex flex-col gap-8">
        <div class="flex flex-col gap-6">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">
              Test runs overview
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Playwright report history across every project, one strip per run.
            </p>
          </div>

          <div
            v-if="projects.length"
            class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/80 px-6 py-5"
          >
            <StatBlock label="Projects" :value="stats.projects" />
            <Separator orientation="vertical" class="h-10" />
            <StatBlock
              label="Global pass rate"
              :value="formatPct(stats.passRate)"
              :tone="stats.passRate >= 0.99 ? 'pass' : stats.passRate >= 0.9 ? 'flaky' : 'fail'"
            />
            <Separator orientation="vertical" class="h-10" />
            <StatBlock label="Tests / latest" :value="stats.tests" />
            <Separator orientation="vertical" class="h-10" />
            <StatBlock label="Total runs" :value="stats.runs" />
            <Separator orientation="vertical" class="h-10" />
            <StatBlock label="Failing now" :value="stats.failing" :tone="stats.failing > 0 ? 'fail' : 'pass'" />
          </div>
        </div>

        <p v-if="projects.length === 0" class="py-16 text-center font-mono text-sm text-muted-foreground">
          No projects yet. Push a run from the reporter or CLI.
        </p>
        <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCard v-for="p in projects" :key="p.id" :project="p" @open="openProject(p)" />
        </div>
      </div>
    </main>
  </div>
</template>
