import { router } from '../trpc/index'
import { billingRouter } from './billing'
import { dashboardRouter } from './dashboard'
import { userRouter } from './user'

export const appRouter = router({
  user: userRouter,
  dashboard: dashboardRouter,
  billing: billingRouter,
})

export type AppRouter = typeof appRouter
