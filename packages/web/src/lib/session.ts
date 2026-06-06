import { ref, shallowRef } from 'vue'
import { trpc } from '@/lib/trpc'

export type SessionUser = Awaited<ReturnType<typeof trpc.user.me.query>>

const user = shallowRef<SessionUser>(null)
const ready = ref(false)
let booting: Promise<void> | undefined

// Resolve the session once on boot; the router guard awaits this before routing.
async function ensure(): Promise<void> {
  if (!booting) {
    booting = (async () => {
      try {
        user.value = await trpc.user.me.query()
      }
      catch {
        user.value = null
      }
      finally {
        ready.value = true
      }
    })()
  }
  return booting
}

function setUser(next: SessionUser): void {
  user.value = next
}

// Re-read the session (after sign-in / sign-up / sign-out).
async function refresh(): Promise<void> {
  try {
    user.value = await trpc.user.me.query()
  }
  catch {
    user.value = null
  }
}

export const session = { user, ready, ensure, setUser, refresh }
