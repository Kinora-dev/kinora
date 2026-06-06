import { router } from '../trpc/index'
import { dashboardRouter } from './dashboard'
import { userRouter } from './user'

export const appRouter = router({
  user: userRouter,
  dashboard: dashboardRouter,
})

export type AppRouter = typeof appRouter
