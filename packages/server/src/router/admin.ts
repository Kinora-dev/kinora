import { adminOverview, listAccounts, runsPerDay, signupsPerWeek } from '../reports/admin-queries'
import { platformAdminProcedure, router } from '../trpc/index'

export const adminRouter = router({
  overview: platformAdminProcedure.query(() => adminOverview()),
  timeseries: platformAdminProcedure.query(async () => ({
    signups: await signupsPerWeek(),
    runs: await runsPerDay(),
  })),
  accounts: platformAdminProcedure.query(() => listAccounts()),
})
