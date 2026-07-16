import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { track } from '@/lib/analytics'
import { trpc } from '@/lib/trpc'

export type ApiKey = Awaited<ReturnType<typeof trpc.tokens.list.query>>[number]

// Shared API-token logic: list, create (one-time reveal), copy, delete. Scoped to the active org.
export function useApiTokens(options?: { autoLoad?: boolean }) {
  const tokens = ref<ApiKey[]>([])
  const loading = ref(true)
  const creating = ref(false)
  const createdKey = ref('') // full token, returned once on creation
  const copied = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      tokens.value = await trpc.tokens.list.query()
    }
    catch {
      toast.error('Could not load tokens')
    }
    finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed)
      return false
    creating.value = true
    try {
      const { key } = await trpc.tokens.create.mutate({ name: trimmed })
      createdKey.value = key
      track('token-generated')
      await load()
      return true
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create token')
      return false
    }
    finally {
      creating.value = false
    }
  }

  async function copyCreatedKey(): Promise<void> {
    await navigator.clipboard.writeText(createdKey.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }

  async function remove(id: string): Promise<void> {
    try {
      await trpc.tokens.revoke.mutate({ id })
      toast.success('Token deleted')
      await load()
    }
    catch {
      toast.error('Could not delete token')
    }
  }

  if (options?.autoLoad ?? true)
    onMounted(load)

  return { tokens, loading, creating, createdKey, copied, load, create, copyCreatedKey, remove }
}
