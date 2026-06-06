import { ref, shallowRef } from 'vue'
import { trpc } from '@/lib/trpc'

export type SessionUser = Awaited<ReturnType<typeof trpc.user.me.query>>

const user = shallowRef<SessionUser>(null)
const ready = ref(false)
let booting: Promise<void> | undefined

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

async function refresh(): Promise<void> {
  try {
    user.value = await trpc.user.me.query()
  }
  catch {
    user.value = null
  }
}

export const session = { user, ready, ensure, setUser, refresh }
