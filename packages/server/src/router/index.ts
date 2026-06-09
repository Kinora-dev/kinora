import { router } from '../trpc/index'
import { alertsRouter } from './alerts'
import { billingRouter } from './billing'
import { dashboardRouter } from './dashboard'
import { userRouter } from './user'

export const appRouter = router({
  user: userRouter,
  dashboard: dashboardRouter,
  billing: billingRouter,
  alerts: alertsRouter,
})

export type AppRouter = typeof appRouter
