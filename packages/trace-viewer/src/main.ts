// Minimal harness: register the vendored service worker, load a trace, and show
// one reconstructed DOM snapshot in the iframe. Proves the engine renders in a
// real browser. Replaced by the Vue UI later.

const statusEl = document.getElementById('status') as HTMLElement
const iframe = document.getElementById('snapshot') as HTMLIFrameElement

function setStatus(text: string): void {
  statusEl.textContent = text
}

interface RawAction {
  pageId?: string
  class?: string
  method?: string
  apiName?: string
  beforeSnapshot?: string
  afterSnapshot?: string
  inputSnapshot?: string
}
interface RawContext {
  actions: RawAction[]
  pages: { pageId: string }[]
}

async function main(): Promise<void> {
  if (!navigator.serviceWorker) {
    setStatus('service workers unsupported (need https or localhost)')
    return
  }
  await navigator.serviceWorker.register('sw.bundle.js')
  if (!navigator.serviceWorker.controller)
    await new Promise<void>((resolve) => { navigator.serviceWorker.oncontrollerchange = () => resolve() })
  setInterval(() => {
    void fetch('ping')
  }, 10000)

  const traceURL = new URL('fixtures/test-trace1.zip', location.href).href
  const res = await fetch(`contexts?trace=${encodeURIComponent(traceURL)}`)
  if (!res.ok) {
    setStatus(`trace load failed: ${await res.text()}`)
    return
  }
  const contexts = await res.json() as RawContext[]

  // Keep the last action that ran on a page and has a DOM snapshot: that is the
  // most complete page state to show. Actions without a pageId (newPage, steps)
  // have no renderable snapshot.
  let pageId: string | undefined
  let name: string | undefined
  let label = ''
  for (const ctx of contexts) {
    for (const action of ctx.actions) {
      const snap = action.afterSnapshot ?? action.beforeSnapshot
      if (snap && action.pageId) {
        pageId = action.pageId
        name = snap
        label = `${action.class ?? ''}.${action.method ?? action.apiName ?? ''}`
      }
    }
  }

  if (!pageId || !name) {
    setStatus('trace loaded but no renderable DOM snapshot found')
    return
  }

  const totalActions = contexts.reduce((n, c) => n + c.actions.length, 0)
  setStatus(`trace loaded · ${contexts.length} context(s) · ${totalActions} actions · snapshot for "${label}"`)
  iframe.src = `snapshot/${pageId}?trace=${encodeURIComponent(traceURL)}&name=${encodeURIComponent(name)}`
}

main().catch((err) => {
  setStatus(`error: ${err?.message ?? err}`)
})
