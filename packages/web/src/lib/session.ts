import { ref, shallowRef } from 'vue'
import { env } from '@/lib/env'
import { trpc } from '@/lib/trpc'

export type SessionUser = Awaited<ReturnType<typeof trpc.user.me.query>>

const user = shallowRef<SessionUser>(null)
const ready = ref(false)
let booting: Promise<void> | undefined

async function ensure(): Promise<void> {
  if (!booting) {
    booting = (async () => {
      // Demo deployments hand the browser a shared read-only session cookie here (no-op elsewhere).
      await fetch(`${env.serverUrl}/api/demo/session`, { credentials: 'include' }).catch(() => {})
      try {
        user.value = await trpc.user.me.query()
      }
      catch {
        user.value = null
      }
      finally {
        setTimeout(() => {
          ready.value = true
        }, 50)
      }
    })()
  }
  return booting
}

function setUser(next: SessionUser): void {
  user.value = next
}

async function refresh(): Promise<void> {
  try {
    user.value = await trpc.user.me.query()
  }
  catch {
    user.value = null
  }
}

export const session = { user, ready, ensure, setUser, refresh }
