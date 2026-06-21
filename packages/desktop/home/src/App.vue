<script setup lang="ts">
import type { Project, RunReport, SessionUser, TestHistory } from '../../src/bridge'
import { latestRun, stripAnsi } from '@kinora/core'
import { Button } from '@kinora/ui/button'
import { Card, CardContent } from '@kinora/ui/card'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
const reportLoading = ref(false)
const projectPaths = ref<Record<string, string>>({})
const highlightLink = ref(false)
const rerun = ref<{ title: string, status: 'running' | 'passed' | 'failed' | 'error', log: string, hasTrace: boolean, watch: boolean } | null>(null)
const logEl = ref<HTMLElement | null>(null)
const updateReady = ref(false)
const isDev = window.kinora.isDev

const rerunStatusText = computed(() => {
  const s = rerun.value?.status
  return s === 'running' ? 'Running…' : s === 'passed' ? 'Passed' : s === 'failed' ? 'Failed' : s === 'error' ? 'Error' : ''
})
const rerunStatusCls = computed(() => (rerun.value?.status === 'passed' ? 'text-pass' : rerun.value?.status === 'running' ? 'text-signal' : 'text-fail'))
// Strip the whole buffer (not per-chunk) so the line reporter's cursor codes (ESC[1A/[2K) go.
const rerunLog = computed(() => stripAnsi(rerun.value?.log ?? ''))

const activeProject = computed(() => projects.value.find(p => p.id === activeId.value) ?? null)
const activePath = computed(() => (activeId.value ? projectPaths.value[activeId.value] ?? null : null))

// Load the active project's latest run (the failures inbox renders from it).
async function loadActive(): Promise<void> {
  report.value = null
  histories.value = []
  const p = activeProject.value
  if (!p)
    return
  const latest = latestRun(p)
  if (!latest)
    return
  reportLoading.value = true
  try {
    const [run, hist] = await Promise.all([
      window.kinora.run({ projectId: p.id, runId: latest.runId }),
      window.kinora.projectHistory({ projectId: p.id }),
    ])
    report.value = run
    histories.value = hist
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
  projectPaths.value = await window.kinora.projectPaths()
  const stored = localStorage.getItem(STORE_KEY)
  activeId.value = projects.value.find(p => p.id === stored)?.id ?? projects.value[0]?.id ?? null
  view.value = 'projects'
  await loadActive()
}

onMounted(refresh)

window.kinora.onDevicePending((info) => {
  deviceCode.value = info.userCode
})

window.kinora.onUpdateReady(() => {
  updateReady.value = true
})

window.kinora.onRerunStarted(() => {
  if (rerun.value) {
    rerun.value.status = 'running'
    rerun.value.log = ''
    rerun.value.hasTrace = false
  }
})
window.kinora.onRerunOutput((chunk) => {
  if (rerun.value)
    rerun.value.log += chunk
})
window.kinora.onRerunDone((r) => {
  if (!rerun.value)
    return
  rerun.value.status = r.code === -1 ? 'error' : r.ok ? 'passed' : 'failed'
  rerun.value.hasTrace = r.hasTrace
})

// Tail the live log to the latest output.
watch(() => rerun.value?.log, () => {
  void nextTick(() => {
    if (logEl.value)
      logEl.value.scrollTop = logEl.value.scrollHeight
  })
})

function selectProject(id: string): void {
  // The re-run/watch session is tied to a test in the current project; end it on switch.
  if (rerun.value)
    closeRerun()
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

function restartToUpdate(): void {
  void window.kinora.restartToUpdate()
}

function onViewTrace(traceUrl: string): void {
  void window.kinora.openTraceUrl(traceUrl)
}

let linkPulseTimer: ReturnType<typeof setTimeout> | undefined
// A disabled Re-run/Open was clicked: flash the header's "Link folder" to guide the user.
function onRequestLink(): void {
  highlightLink.value = true
  clearTimeout(linkPulseTimer)
  linkPulseTimer = setTimeout(() => {
    highlightLink.value = false
  }, 1800)
}

async function linkActiveProject(): Promise<string | null> {
  const id = activeId.value
  if (!id)
    return null
  const dir = await window.kinora.setProjectPath(id)
  if (dir)
    projectPaths.value = { ...projectPaths.value, [id]: dir }
  return dir
}

async function onOpenInEditor(loc: { file: string, line: number, column: number }): Promise<void> {
  const id = activeId.value
  if (!id)
    return
  // First open prompts to link the local repo; cancel = no-op.
  if (!projectPaths.value[id] && !(await linkActiveProject()))
    return
  const res = await window.kinora.openInEditor({ projectId: id, ...loc })
  if (!res.ok && res.error && res.error !== 'no-path')
    error.value = res.error
}

async function onRerun(t: { file: string, line: number, projectName: string, title: string }): Promise<void> {
  const id = activeId.value
  if (!id)
    return
  if (!projectPaths.value[id] && !(await linkActiveProject()))
    return
  rerun.value = { title: t.title, status: 'running', log: '', hasTrace: false, watch: false }
  const res = await window.kinora.rerunTest({ projectId: id, file: t.file, line: t.line, projectName: t.projectName })
  if (!res.ok && res.error && res.error !== 'no-path') {
    rerun.value.status = 'error'
    rerun.value.log = res.error
  }
}
function stopRerun(): void {
  void window.kinora.cancelRerun()
}
function toggleWatch(): void {
  if (!rerun.value)
    return
  rerun.value.watch = !rerun.value.watch
  void window.kinora.setWatch(rerun.value.watch)
}
function closeRerun(): void {
  void window.kinora.setWatch(false)
  void window.kinora.cancelRerun()
  rerun.value = null
}
function viewRerunTrace(): void {
  void window.kinora.openRerunTrace()
}
</script>

<template>
  <!-- login: single device flow (signs in via the system browser: github/google/email) -->
  <div v-if="view === 'login'" class="app-grid relative flex h-full flex-col items-center justify-center gap-7 bg-background p-6">
    <div class="app-drag absolute inset-x-0 top-0 h-10" />
    <div class="flex flex-col items-center gap-2 text-center">
      <div class="flex items-center gap-2.5">
        <span
          class="size-2.5 rounded-full bg-signal"
          style="animation: rec-pulse 2s ease-in-out infinite"
          aria-hidden="true"
        />
        <span class="font-mono text-xl font-semibold tracking-tight lowercase">kinora</span>
        <span v-if="isDev" class="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-400 uppercase">dev</span>
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
  <div v-else-if="view === 'loading'" class="relative flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
    <div class="app-drag absolute inset-x-0 top-0 h-10" />
    Loading…
  </div>

  <!-- dashboard: failures of the active project's latest run -->
  <div v-else class="app-grid flex h-full flex-col bg-background text-foreground">
    <AppHeader
      :projects="projects"
      :active-id="activeId"
      :user="user"
      :project-path="activePath"
      :highlight-link="highlightLink"
      :update-ready="updateReady"
      @select="selectProject"
      @open-trace="openTrace"
      @open-account="openAccount"
      @link-folder="linkActiveProject"
      @logout="onLogout"
      @restart-update="restartToUpdate"
    />

    <main class="w-full flex-1 overflow-auto">
      <div class="mx-auto w-full max-w-4xl px-5 py-8">
        <p v-if="projects.length === 0" class="py-16 text-center font-mono text-sm text-muted-foreground">
          No projects yet. Push a run from the reporter or CLI.
        </p>
        <Failures
          v-else-if="activeProject"
          :key="activeProject.id"
          :project="activeProject"
          :report="report"
          :histories="histories"
          :loading="reportLoading"
          :linked="!!activePath"
          @view-trace="onViewTrace"
          @open-in-editor="onOpenInEditor"
          @rerun="onRerun"
          @request-link="onRequestLink"
        />
      </div>
    </main>

    <!-- local re-run: live output + result -->
    <div v-if="rerun" class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <div class="mx-auto max-w-4xl px-5 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <span class="font-mono text-[11px] tracking-wider uppercase" :class="rerunStatusCls">{{ rerunStatusText }}</span>
            <span class="truncate text-sm">{{ rerun.title }}</span>
            <span v-if="rerun.watch && rerun.status !== 'running'" class="shrink-0 font-mono text-[10px] text-muted-foreground">· watching for changes</span>
          </div>
          <div class="flex shrink-0 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              class="h-7 font-mono text-[11px]"
              :class="rerun.watch ? 'border-signal text-signal' : ''"
              title="Auto re-run when you save a file"
              @click="toggleWatch"
            >
              {{ rerun.watch ? 'Watching' : 'Watch' }}
            </Button>
            <Button v-if="rerun.status === 'running'" variant="outline" size="sm" class="h-7 font-mono text-[11px]" @click="stopRerun">
              Stop
            </Button>
            <Button v-if="rerun.hasTrace" variant="outline" size="sm" class="h-7 font-mono text-[11px]" @click="viewRerunTrace">
              View trace
            </Button>
            <Button variant="ghost" size="sm" class="h-7 font-mono text-[11px] text-muted-foreground" @click="closeRerun">
              Close
            </Button>
          </div>
        </div>
        <pre ref="logEl" class="mt-2 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{{ rerunLog }}</pre>
      </div>
    </div>
  </div>
</template>
