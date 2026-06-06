import { router } from '../trpc/index'
import { projectsRouter } from './projects'
import { runsRouter } from './runs'

export const appRouter = router({
  projects: projectsRouter,
  runs: runsRouter,
})

export type AppRouter = typeof appRouter
