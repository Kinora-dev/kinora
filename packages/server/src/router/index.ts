import { router } from '../trpc/index'
import { adminRouter } from './admin'
import { alertsRouter } from './alerts'
import { billingRouter } from './billing'
import { configRouter } from './config'
import { dashboardRouter } from './dashboard'
import { feedbackRouter } from './feedback'
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
  feedback: feedbackRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
