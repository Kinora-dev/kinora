import { router } from '../trpc/index'
import { ingestRouter } from './ingest'

export const publicApiRouter = router({
  ingest: ingestRouter,
})

export type PublicApiRouter = typeof publicApiRouter
