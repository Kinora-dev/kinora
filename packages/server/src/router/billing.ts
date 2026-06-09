import { getEntitlements } from '../billing/entitlements'
import { currentPeriodResults } from '../billing/usage'
import { authProcedure, router } from '../trpc/index'

// Infinity doesn't survive JSON: unlimited limits go over the wire as null.
function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null
}

export const billingRouter = router({
  summary: authProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id
    const [entitlements, usedResults] = await Promise.all([
      getEntitlements(userId),
      currentPeriodResults(userId),
    ])

    return {
      tier: entitlements.tier,
      alerts: entitlements.alerts,
      maxProjects: finiteOrNull(entitlements.maxProjects),
      retentionDays: finiteOrNull(entitlements.retentionDays),
      includedResults: finiteOrNull(entitlements.includedResults),
      usedResults,
    }
  }),
})
