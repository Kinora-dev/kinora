import { useAsyncState } from '@vueuse/core'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { trpc } from '@/lib/trpc'

type Policy = 'always' | 'on-failure' | 'on-regression'

export function useAlerts(projectId: string) {
  const { state: config, isLoading, execute: refresh } = useAsyncState(
    () => trpc.alerts.get.query({ projectId }),
    null,
    { immediate: true },
  )

  const saving = ref(false)
  const testing = ref(false)

  async function save(input: { webhookUrl: string, policy: Policy, enabled: boolean }): Promise<void> {
    saving.value = true
    try {
      await trpc.alerts.upsert.mutate({ projectId, ...input })
      await refresh()
      toast.success('Slack alerts saved')
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save Slack alerts')
    }
    finally {
      saving.value = false
    }
  }

  async function sendTest(): Promise<void> {
    testing.value = true
    try {
      await trpc.alerts.test.mutate({ projectId })
      toast.success('Test message sent to Slack')
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test message failed')
    }
    finally {
      testing.value = false
    }
  }

  return { config, isLoading, saving, testing, refresh, save, sendTest }
}
