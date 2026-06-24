import * as Sentry from '@sentry/node'
import pkg from '../package.json'
import { env } from './lib/env'

if (env.KINORA_CLOUD && env.NODE_ENV === 'production' && env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: 'production',
    release: `@kinora/server@${pkg.version}`,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // kinora ingests customer DOM/network/test data; never let request bodies or auth reach Sentry.
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        const headers = event.request.headers
        if (headers) {
          for (const k of Object.keys(headers)) {
            if (/^(?:authorization|cookie|x-api-key)$/i.test(k))
              delete headers[k]
          }
        }
      }
      return event
    },
  })
}
