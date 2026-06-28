import { router } from '../trpc/index'
import { alertsRouter } from './alerts'
import { billingRouter } from './billing'
import { configRouter } from './config'
import { dashboardRouter } from './dashboard'
import { projectRouter } from './project'
import { tokenRouter } from './tokens'
import { userRouter } from './user'

export const appRouter = router({
  user: userRouter,
  config: configRouter,
  dashboard: dashboardRouter,
  billing: billingRouter,
  alerts: alertsRouter,
  project: projectRouter,
  tokens: tokenRouter,
})

export type AppRouter = typeof appRouter
