import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'

export type ApiKey = NonNullable<Awaited<ReturnType<typeof authClient.apiKey.list>>['data']>['apiKeys'][number]

// Shared API-token logic: list, create (one-time reveal), copy, delete.
export function useApiTokens(options?: { autoLoad?: boolean }) {
  const tokens = ref<ApiKey[]>([])
  const loading = ref(true)
  const creating = ref(false)
  const createdKey = ref('') // full token, returned once on creation
  const copied = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    const { data, error } = await authClient.apiKey.list()
    if (error)
      toast.error('Could not load tokens')
    else
      tokens.value = data?.apiKeys ?? []
    loading.value = false
  }

  async function create(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed)
      return false
    creating.value = true
    const { data, error } = await authClient.apiKey.create({ name: trimmed })
    creating.value = false
    if (error || !data) {
      toast.error(error?.message ?? 'Could not create token')
      return false
    }
    createdKey.value = data.key
    await load()
    return true
  }

  async function copyCreatedKey(): Promise<void> {
    await navigator.clipboard.writeText(createdKey.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }

  async function remove(id: string): Promise<void> {
    const { error } = await authClient.apiKey.delete({ keyId: id })
    if (error) {
      toast.error('Could not delete token')
      return
    }
    toast.success('Token deleted')
    await load()
  }

  if (options?.autoLoad ?? true)
    onMounted(load)

  return { tokens, loading, creating, createdKey, copied, load, create, copyCreatedKey, remove }
}
