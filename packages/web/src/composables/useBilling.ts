import { useAsyncState } from '@vueuse/core'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { trpc } from '@/lib/trpc'

export function useBilling() {
  const { state: summary, isLoading, execute: refresh } = useAsyncState(
    () => trpc.billing.summary.query(),
    null,
    { immediate: true, resetOnExecute: false },
  )

  // Which billing action is mid-flight, so the buttons can disable + show progress.
  const pending = ref<'team' | 'pro' | 'portal' | null>(null)

  async function checkout(slug: 'team' | 'pro'): Promise<void> {
    pending.value = slug
    try {
      const { error } = await authClient.checkout({ slug })
      if (error)
        toast.error(error.message ?? 'Could not start checkout')
    }
    finally {
      pending.value = null
    }
  }

  async function openPortal(): Promise<void> {
    pending.value = 'portal'
    try {
      const { error } = await authClient.customer.portal()
      if (error)
        toast.error(error.message ?? 'Could not open the billing portal')
    }
    finally {
      pending.value = null
    }
  }

  return { summary, isLoading, refresh, pending, checkout, openPortal }
}
