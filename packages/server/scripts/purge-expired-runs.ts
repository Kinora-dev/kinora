import process from 'node:process'
import { purgeExpiredRuns } from '../src/billing/retention'
import { logger } from '../src/lib/logger'

purgeExpiredRuns(new Date())
  .then(({ deleted, artifacts }) => {
    logger.info({ deleted, artifacts }, 'purge-expired-runs complete')
    process.exit(0)
  })
  .catch((error) => {
    logger.error({ error }, 'purge-expired-runs failed')
    process.exit(1)
  })
