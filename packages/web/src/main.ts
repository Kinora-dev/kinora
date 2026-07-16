import * as Sentry from '@sentry/vue'
import { createApp } from 'vue'
import App from './App.vue'
import { initAnalytics } from './lib/analytics'
import { env } from './lib/env'
import { router } from './router'
import './style.css'

initAnalytics()

const app = createApp(App)

if (import.meta.env.PROD && import.meta.env.VITE_KINORA_CLOUD === 'true' && env.sentryDsn) {
  Sentry.init({
    app,
    dsn: env.sentryDsn,
    environment: 'production',
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

app.use(router).mount('#app')
