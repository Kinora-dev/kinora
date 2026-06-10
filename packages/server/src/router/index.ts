import { router } from '../trpc/index'
import { alertsRouter } from './alerts'
import { billingRouter } from './billing'
import { dashboardRouter } from './dashboard'
import { projectRouter } from './project'
import { tokenRouter } from './tokens'
import { userRouter } from './user'

export const appRouter = router({
  user: userRouter,
  dashboard: dashboardRouter,
  billing: billingRouter,
  alerts: alertsRouter,
  project: projectRouter,
  tokens: tokenRouter,
})

export type AppRouter = typeof appRouter
