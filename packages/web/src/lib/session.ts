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

type AuthUser = Omit<NonNullable<SessionUser>, 'hasPassword' | 'createdAt' | 'updatedAt'> & { createdAt: string | Date, updatedAt: string | Date }

function setUserFromAuth(authUser: AuthUser, hasPassword: boolean): void {
  user.value = {
    ...authUser,
    createdAt: new Date(authUser.createdAt).toISOString(),
    updatedAt: new Date(authUser.updatedAt).toISOString(),
    hasPassword,
  }
}

async function refresh(): Promise<void> {
  try {
    user.value = await trpc.user.me.query()
  }
  catch {
    user.value = null
  }
}

export const session = { user, ready, ensure, setUser, setUserFromAuth, refresh }
