import { router } from '../trpc/index'
import { projectsRouter } from './projects'
import { runsRouter } from './runs'
import { userRouter } from './user'

export const appRouter = router({
  user: userRouter,
  projects: projectsRouter,
  runs: runsRouter,
})

export type AppRouter = typeof appRouter
