import type { ContextEntry } from '@isomorphic/trace/entries'
import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel'
import type { Snapshot, SnapshotTab } from './lib/snapshots'
import { buildActionTree, TraceModel } from '@isomorphic/trace/traceModel'
import { computed, ref, shallowRef } from 'vue'
import { collectSnapshots, snapshotInfoUrl, snapshotUrl } from './lib/snapshots'

export interface ActionItem {
  id: string
  depth: number
  action: ActionTraceEventInContext
}

export interface SnapshotInfo {
  url?: string
  viewport?: { width: number, height: number }
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

const status = ref<Status>('idle')
const errorMessage = ref('')
const traceUri = ref('')
const model = shallowRef<TraceModel | null>(null)
const items = shallowRef<ActionItem[]>([])
const selectedId = ref<string | null>(null)
const snapshotTab = ref<SnapshotTab>('action')
const snapshotInfo = ref<SnapshotInfo>({})
const playing = ref(false)
let playTimer: ReturnType<typeof setInterval> | undefined

function flatten(m: TraceModel): ActionItem[] {
  const { rootItem } = buildActionTree(m.actions)
  const out: ActionItem[] = []
  const visit = (node: typeof rootItem, depth: number): void => {
    for (const child of node.children) {
      out.push({ id: child.id, depth, action: child.action })
      visit(child, depth + 1)
    }
  }
  visit(rootItem, 0)
  return out
}

async function registerServiceWorker(): Promise<void> {
  if (!navigator.serviceWorker)
    throw new Error('Service workers unavailable. Serve over https or localhost.')
  await navigator.serviceWorker.register('sw.bundle.js')
  if (!navigator.serviceWorker.controller)
    await new Promise<void>((resolve) => { navigator.serviceWorker.oncontrollerchange = () => resolve() })
  setInterval(() => {
    void fetch('ping')
  }, 10_000)
}

async function load(uri: string): Promise<void> {
  status.value = 'loading'
  traceUri.value = uri
  try {
    await registerServiceWorker()
    const res = await fetch(`contexts?trace=${encodeURIComponent(uri)}`)
    if (!res.ok)
      throw new Error(await res.text())
    const contexts = await res.json() as ContextEntry[]
    const m = new TraceModel(uri, contexts)
    model.value = m
    items.value = flatten(m)
    // Default selection: failed action, else the last page action with a
    // snapshot (most representative page state), else the first action.
    const failed = m.failedAction()
    const lastWithPage = [...items.value].reverse().find(
      i => (i.action as any).pageId && ((i.action as any).afterSnapshot || (i.action as any).beforeSnapshot),
    )
    selectedId.value = (failed?.callId ?? lastWithPage?.id ?? items.value[0]?.id) ?? null
    status.value = 'ready'
  }
  catch (err: any) {
    errorMessage.value = err?.message ?? String(err)
    status.value = 'error'
  }
}

const selectedIndex = computed(() => items.value.findIndex(i => i.id === selectedId.value))
const selectedAction = computed<ActionTraceEventInContext | undefined>(() => items.value[selectedIndex.value]?.action)
const snapshots = computed(() => collectSnapshots(selectedAction.value))
const currentSnapshot = computed<Snapshot | undefined>(() => snapshots.value[snapshotTab.value])
const currentSnapshotUrl = computed(() => snapshotUrl(traceUri.value, currentSnapshot.value))

function select(id: string): void {
  selectedId.value = id
}

function step(delta: number): void {
  const next = selectedIndex.value + delta
  if (next >= 0 && next < items.value.length)
    selectedId.value = items.value[next].id
}

function setTab(tab: SnapshotTab): void {
  snapshotTab.value = tab
}

function stopPlay(): void {
  playing.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = undefined
  }
}

// Auto-advance selection through actions (slideshow). Stops at the last action.
function togglePlay(): void {
  if (playing.value) {
    stopPlay()
    return
  }
  if (selectedIndex.value >= items.value.length - 1)
    selectedId.value = items.value[0]?.id ?? null
  playing.value = true
  playTimer = setInterval(() => {
    if (selectedIndex.value >= items.value.length - 1) {
      stopPlay()
      return
    }
    step(1)
  }, 700)
}

async function refreshSnapshotInfo(): Promise<void> {
  const infoUrl = snapshotInfoUrl(traceUri.value, currentSnapshot.value)
  if (!infoUrl) {
    snapshotInfo.value = {}
    return
  }
  try {
    const res = await fetch(infoUrl)
    snapshotInfo.value = res.ok ? await res.json() : {}
  }
  catch {
    snapshotInfo.value = {}
  }
}

export function useTraceStore() {
  return {
    status,
    errorMessage,
    traceUri,
    model,
    items,
    selectedId,
    selectedIndex,
    selectedAction,
    snapshotTab,
    snapshots,
    currentSnapshot,
    currentSnapshotUrl,
    snapshotInfo,
    playing,
    load,
    select,
    step,
    setTab,
    togglePlay,
    refreshSnapshotInfo,
  }
}
