<script setup lang="ts">
import type { Project } from '../../src/bridge'
import { Badge } from '@kinora/ui/badge'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { onMounted, ref } from 'vue'

const view = ref<'loading' | 'login' | 'projects'>('loading')
const serverUrl = ref('http://localhost:3000')
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const projects = ref<Project[]>([])

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

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
  view.value = 'login'
}

function openTrace(): void {
  void window.kinora.openLocalTrace()
}

function lastRun(p: Project) {
  return p.runs[0]
}

function lastRunWhen(p: Project): string {
  const run = lastRun(p)
  return run ? new Date(run.startedAt).toLocaleString() : 'No runs yet'
}
</script>

<template>
  <div class="flex h-full flex-col bg-background text-foreground">
    <!-- top bar -->
    <header class="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-5">
      <span class="size-2 rounded-full bg-signal" style="animation: rec-pulse 2s ease-in-out infinite" />
      <span class="text-sm font-semibold tracking-tight">kinora</span>
      <span class="font-mono text-[11px] text-muted-foreground">desktop</span>
      <div v-if="view === 'projects'" class="ml-auto flex items-center gap-3">
        <span class="font-mono text-[11px] text-muted-foreground">{{ serverUrl }}</span>
        <Button variant="outline" size="sm" @click="openTrace">
          Open trace
        </Button>
        <Button variant="ghost" size="sm" @click="onLogout">
          Sign out
        </Button>
      </div>
    </header>

    <!-- loading -->
    <div v-if="view === 'loading'" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>

    <!-- login -->
    <div v-else-if="view === 'login'" class="flex flex-1 items-center justify-center p-6">
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

    <!-- projects -->
    <div v-else class="flex-1 overflow-auto p-6">
      <h1 class="mb-4 text-sm font-semibold tracking-tight">
        Projects <span class="font-mono text-xs text-muted-foreground">({{ projects.length }})</span>
      </h1>
      <p v-if="projects.length === 0" class="text-sm text-muted-foreground">
        No projects yet. Push a run from the reporter or CLI.
      </p>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="p in projects" :key="p.id" data-project>
          <CardHeader>
            <CardTitle class="text-sm">
              {{ p.name }}
            </CardTitle>
            <span class="font-mono text-[11px] text-muted-foreground">{{ p.id }}</span>
          </CardHeader>
          <CardContent class="space-y-2">
            <div v-if="lastRun(p)" class="flex flex-wrap gap-1.5">
              <Badge variant="outline" class="border-pass/30 text-pass">
                {{ lastRun(p).counts.expected }} passed
              </Badge>
              <Badge v-if="lastRun(p).counts.unexpected" variant="outline" class="border-fail/30 text-fail">
                {{ lastRun(p).counts.unexpected }} failed
              </Badge>
              <Badge v-if="lastRun(p).counts.flaky" variant="outline" class="border-signal/30 text-signal">
                {{ lastRun(p).counts.flaky }} flaky
              </Badge>
            </div>
            <p class="font-mono text-[11px] text-muted-foreground">
              {{ lastRunWhen(p) }}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
