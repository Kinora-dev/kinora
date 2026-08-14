import { getEntitlements, getSubscription } from '../billing/entitlements'
import { currentPeriodResults, storageBytes } from '../billing/usage'
import { orgProcedure, router } from '../trpc/index'

// Infinity doesn't survive JSON: unlimited limits go over the wire as null.
function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null
}

export const billingRouter = router({
  summary: orgProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId
    const [entitlements, sub, usedResults, usedStorageBytes] = await Promise.all([
      getEntitlements(organizationId),
      getSubscription(organizationId),
      currentPeriodResults(organizationId),
      storageBytes(organizationId),
    ])

    return {
      tier: entitlements.tier,
      alerts: entitlements.alerts,
      maxProjects: finiteOrNull(entitlements.maxProjects),
      retentionDays: finiteOrNull(entitlements.retentionDays),
      includedResults: finiteOrNull(entitlements.includedResults),
      usedResults,
      storageBytes: finiteOrNull(entitlements.storageBytes),
      usedStorageBytes,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    }
  }),
})
